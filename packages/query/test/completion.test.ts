import { describe, expect, it } from "vitest";
import { createCommandRegistry } from "../src/commands.ts";
import {
  type CompletionRow,
  commandCompletionSlot,
  filterOptions,
  keyRows,
  orderRows,
  queryCompletionSlot,
  quoteArgument,
  slotValues,
  valueRows,
} from "../src/completion.ts";
import {
  type CompiledQuerySchema,
  defineQuerySchema,
  parseQuery,
} from "../src/query.ts";
import {
  providerOf,
  type ValueProviders,
  type ValueSpec,
} from "../src/values.ts";
import { todouQualifiers, todouSchema } from "./fixtures/todou-schema.ts";

const PROVIDERS: ValueProviders = {
  label: { options: [{ value: "area:web" }, { value: "kind:bug" }] },
  status: { options: [{ value: "Todo" }, { value: "In Progress" }] },
  member: { options: [{ value: "alice" }] },
  harness: {
    options: [{ value: "codex", hint: "12" }, { value: "claude-code" }],
  },
  session: { options: [{ value: "sess-a", hint: "codex" }] },
};

/** `query` with `|` marking the caret. */
function at(marked: string, schema: CompiledQuerySchema = todouSchema) {
  const caret = marked.indexOf("|");
  const query = marked.replace("|", "");
  const parts = parseQuery(schema, query);
  return {
    query,
    caret,
    slot: queryCompletionSlot(schema, parts, query, caret),
  };
}

const keys = (marked: string) => {
  const { query, slot } = at(marked);
  return keyRows(todouSchema, query, slot);
};

function values(marked: string, schema: CompiledQuerySchema = todouSchema) {
  const { query, slot } = at(marked, schema);
  if (slot?.kind !== "value") return valueRows(schema, query, slot, []);
  const options = slotValues(slot, providerOf(slot.spec, PROVIDERS));
  if (options === "fetch") throw new Error("no search provider here");
  return valueRows(schema, query, slot, filterOptions(options, slot.typed));
}

describe("the qualifier key source", () => {
  it("matches a non-empty prefix of a key", () => {
    const { matched, rows } = keys("har|");
    expect(matched).toBe(true);
    expect(rows.map((r) => r.text)).toEqual(["harness:"]);
    expect(rows[0]?.apply).toEqual({ value: "harness:", caret: 8 });
  });

  it("lists every key after a space, but does not call it a match", () => {
    // The full table is how the syntax is discovered; it just waits below
    // the search row so Enter cannot trip over it.
    const { matched, rows } = keys("部署 |");
    expect(matched).toBe(false);
    // Counted off the registry rather than written down, so adding a
    // qualifier does not fail a test about something else.
    expect(rows).toHaveLength(todouSchema.keys.length);
  });

  it("offers nothing for a word that prefixes no key", () => {
    expect(keys("部署|")).toEqual({ matched: false, rows: [] });
  });

  it("keeps a leading minus when it completes", () => {
    const { matched, rows } = keys("-lab|");
    expect(matched).toBe(true);
    expect(rows[0]?.apply).toEqual({ value: "-label:", caret: 7 });
  });

  it("stays out of a filter and out of quotes", () => {
    expect(keys("harness:cod|").rows).toEqual([]);
    expect(keys('"har|').rows).toEqual([]);
  });

  it("completes the word the caret is in, not the whole query", () => {
    const { rows } = keys("部署 sta|");
    expect(rows.map((r) => r.text)).toEqual(["state:", "status:"]);
    expect(rows[0]?.apply).toEqual({ value: "部署 state:", caret: 9 });
  });

  it("leaves the caret on the colon, with no space after it", () => {
    // Only a *value* ends a word (T-268). A key is followed immediately by
    // its value, and so is any other mid-word completion — a prefix offered
    // as `ACC-` is there to have `1` typed onto it.
    const { rows } = keys("har|");
    expect(rows[0]?.apply).toEqual({ value: "harness:", caret: 8 });
  });

  it("says in one line what a key takes", () => {
    const { rows } = keys("harn|");
    expect(rows[0]?.hint).toBe("which agent wrote it");
    for (const row of rows) expect(row.hint ?? "").not.toContain("\n");
  });
});

describe("the qualifier value source", () => {
  it("matches as soon as the colon is there, even with nothing typed", () => {
    const { matched, rows } = values("label:|");
    expect(matched).toBe(true);
    expect(rows.map((r) => r.text)).toEqual(["area:web", "kind:bug"]);
  });

  it("narrows to what has been typed, case-insensitively", () => {
    expect(values("status:in|").rows.map((r) => r.text)).toEqual([
      '"In Progress"',
    ]);
    expect(values("label:AREA|").rows.map((r) => r.text)).toEqual(["area:web"]);
  });

  it("quotes a value that would not read back as one", () => {
    const { rows } = values("status:In|");
    const row = rows.find((r) => r.text.includes("Progress")) as CompletionRow;
    expect(row.text).toBe('"In Progress"');
    expect(row.apply).toEqual({ value: 'status:"In Progress" ', caret: 21 });
  });

  it("ends the word, so the next one can just be typed", () => {
    const { rows } = values("label:kin|");
    expect(rows[0]?.apply).toEqual({ value: "label:kind:bug ", caret: 15 });
  });

  it("does not stack a second space on one that is already there", () => {
    const { rows } = values("label:kin| 部署");
    // The caret still steps past the space: taking an offer leaves the reader
    // at the start of the next word either way.
    expect(rows[0]?.apply).toEqual({ value: "label:kind:bug 部署", caret: 15 });
  });

  it("offers a closed set without asking the project", () => {
    expect(values("is:|").rows.map((r) => r.text)).toEqual([
      "body",
      "comment",
      "spec",
    ]);
    expect(values("state:|").rows.map((r) => r.text)).toEqual([
      "open",
      "closed",
    ]);
  });

  it("puts the values that stand for themselves in the same list", () => {
    expect(values("harness:|").rows.map((r) => r.text)).toEqual([
      "none",
      "codex",
      "claude-code",
    ]);
    expect(values("assignee:|").rows.map((r) => r.text)).toContain("@me");
  });

  it("replaces only the value under the caret", () => {
    const { rows } = values("label:area:web,kind|");
    const row = rows[0] as CompletionRow;
    expect(row.apply.value).toBe("label:area:web,kind:bug ");
  });

  it("offers nothing where no value goes", () => {
    expect(values("部署|")).toEqual({ matched: false, rows: [] });
    expect(values("label:a |")).toEqual({ matched: false, rows: [] });
  });
});

describe("row order", () => {
  const row = (key: string) => ({ key }) as { key: string };
  const search = row("search");

  it("puts search first until something is really being completed", () => {
    expect(
      orderRows(
        [
          { matched: false, rows: [row("a"), row("b")] },
          { matched: false, rows: [row("c")] },
        ],
        search,
      ).map((r) => r.key),
    ).toEqual(["search", "a", "b", "c"]);
  });

  it("lifts a matching source above it, and only that source", () => {
    expect(
      orderRows(
        [
          { matched: false, rows: [row("a")] },
          { matched: true, rows: [row("b")] },
        ],
        search,
      ).map((r) => r.key),
    ).toEqual(["b", "search", "a"]);
  });

  const many = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => row(`${prefix}${i}`));

  it("stops at twenty, however much a source has to say", () => {
    // A project with forty labels used to open a panel taller than the
    // window, which then gave the page its own scrollbar (T-268).
    const rows = orderRows([{ matched: true, rows: many("m", 40) }], search);
    expect(rows).toHaveLength(21);
    expect(rows.at(-1)).toBe(search);
  });

  it("spends what the matched rows left on the ones below", () => {
    const rows = orderRows(
      [
        { matched: true, rows: many("m", 3) },
        { matched: false, rows: many("u", 30) },
      ],
      search,
    ).map((r) => r.key);
    expect(rows).toHaveLength(21);
    expect(rows.slice(0, 4)).toEqual(["m0", "m1", "m2", "search"]);
    expect(rows.slice(4)).toEqual(many("u", 17).map((r) => r.key));
  });

  it("gives the whole budget to the rows below when nothing matched", () => {
    const rows = orderRows([{ matched: false, rows: many("u", 40) }], search);
    expect(rows).toHaveLength(21);
    expect(rows[0]).toBe(search);
  });
});

describe("a source that yields", () => {
  const row = (key: string) => ({ key }) as { key: string };
  const search = row("search");
  const many = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => row(`${prefix}${i}`));

  it("takes what the firm sources left, and stays above the search row", () => {
    const rows = orderRows(
      [
        { matched: false, rows: many("k", 7) },
        { matched: true, yields: true, rows: many("h", 40) },
      ],
      search,
    ).map((r) => r.key);
    expect(rows.slice(0, 13)).toEqual(many("h", 13).map((r) => r.key));
    expect(rows[13]).toBe("search");
    // The keys are the whole list of them, one row short of nothing: that is
    // what yielding buys, and it is the only place the syntax is discovered.
    expect(rows.slice(14)).toEqual(many("k", 7).map((r) => r.key));
  });

  it("offers nothing at all once the firm sources have spent the budget", () => {
    const rows = orderRows(
      [
        { matched: true, rows: many("m", 20) },
        { matched: true, yields: true, rows: many("h", 5) },
      ],
      search,
    ).map((r) => r.key);
    expect(rows).toEqual([...many("m", 20).map((r) => r.key), "search"]);
  });

  it("serves its own matched band before its weaker one", () => {
    const rows = orderRows(
      [
        { matched: false, rows: many("k", 17) },
        { matched: true, yields: true, rows: many("h", 2) },
        { matched: false, yields: true, rows: many("c", 5) },
      ],
      search,
    ).map((r) => r.key);
    expect(rows.slice(0, 2)).toEqual(["h0", "h1"]);
    expect(rows[2]).toBe("search");
    expect(rows.slice(3)).toEqual(
      [...many("k", 17), row("c0")].map((r) => r.key),
    );
  });
});

const plainBraces = defineQuerySchema({ ...todouQualifiers, braces: true });
const shell = defineQuerySchema({ ...todouQualifiers, escapes: "shell" });
const shellBraces = defineQuerySchema({
  ...todouQualifiers,
  escapes: "shell",
  braces: true,
});

/** The slot's extent as the text it covers, plus what it reads as typed. */
function extent(marked: string, schema: CompiledQuerySchema) {
  const { query, slot } = at(marked, schema);
  if (slot === null) return null;
  return {
    covers: query.slice(slot.from, slot.to),
    typed: slot.typed,
    inBraces: "inBraces" in slot ? slot.inBraces : undefined,
  };
}

describe("query slots inside a brace group", () => {
  it.each([plainBraces, shellBraces])(
    "cover only the current alternative",
    (schema) => {
      expect(extent("label:area:{web,u|", schema)).toEqual({
        covers: "u",
        typed: "u",
        inBraces: true,
      });
      expect(extent("label:{area:web,ki|", schema)).toEqual({
        covers: "ki",
        typed: "ki",
        inBraces: true,
      });
      expect(extent("label:{|", schema)).toEqual({
        covers: "",
        typed: "",
        inBraces: true,
      });
    },
  );

  it.each([plainBraces, shellBraces])(
    "reach to the end of the alternative past the caret",
    (schema) => {
      expect(extent("label:{web,u|i}", schema)).toEqual({
        covers: "ui",
        typed: "ui",
        inBraces: true,
      });
    },
  );

  it.each([plainBraces, shellBraces])(
    "are ordinary values once the group has closed",
    (schema) => {
      expect(extent("label:{a,b},ki|", schema)).toEqual({
        covers: "ki",
        typed: "ki",
        inBraces: false,
      });
    },
  );

  it("keep the group open on accept, with no space after", () => {
    const { rows } = values("label:{area:web,ki|", plainBraces);
    expect(rows[0]?.apply).toEqual({
      value: "label:{area:web,kind:bug",
      caret: 24,
    });
  });

  it("are not groups with braces off", () => {
    expect(extent("label:{area:web,ki|", todouSchema)).toEqual({
      covers: "ki",
      typed: "ki",
      inBraces: false,
    });
    expect(extent("label:{ki|", shell)).toEqual({
      covers: "{ki",
      typed: "{ki",
      inBraces: false,
    });
  });

  it("read a quoted alternative in shell mode", () => {
    expect(extent("status:{Todo,'In P|", shellBraces)).toEqual({
      covers: "'In P",
      typed: "In P",
      inBraces: true,
    });
  });
});

describe("shell-mode query slots", () => {
  it("read a value through its quotes", () => {
    expect(extent("status:'In P|", shell)).toEqual({
      covers: "'In P",
      typed: "In P",
      inBraces: false,
    });
  });

  it("stay out of a quoted word as a key", () => {
    expect(at("'har|", shell).slot).toBeNull();
    expect(at('"har|', shell).slot).toBeNull();
  });
});

describe("insert quoting", () => {
  it("follows the query's mode", () => {
    const quoted = (marked: string, schema: CompiledQuerySchema) =>
      values(marked, schema).rows.map((r) => r.text);
    expect(quoted("status:In|", todouSchema)).toEqual(['"In Progress"']);
    expect(quoted("status:In|", shell)).toEqual(["'In Progress'"]);
  });

  it("quotes braces in a value when braces are on", () => {
    const schema = defineQuerySchema({
      qualifiers: { label: { value: { kind: "named", source: "label" } } },
      braces: true,
    });
    const { query, slot } = at("label:|", schema);
    expect(
      valueRows(schema, query, slot, [{ value: "{draft}" }]).rows[0]?.text,
    ).toBe('"{draft}"');
  });
});

const NAMED = { kind: "named", source: "status" } as const;
const MEMBER = { kind: "named", source: "member", special: ["@me"] } as const;

const registry = createCommandRegistry([
  {
    name: "close",
    detail: "",
    args: [],
    summarize: () => "",
    compile: () => 1,
  },
  {
    name: "label",
    detail: "",
    args: [{ name: "label", value: NAMED, rest: true }],
    summarize: () => "",
    compile: () => 1,
  },
  {
    name: "assign",
    detail: "",
    args: [{ name: "login", value: MEMBER, multiple: true }],
    summarize: () => "",
    compile: () => 1,
  },
  {
    name: "tag",
    detail: "",
    args: [{ name: "tag", value: NAMED, rest: true, multiple: true }],
    summarize: () => "",
    compile: () => 1,
  },
  {
    name: "route",
    detail: "",
    args: [
      { name: "from", value: NAMED },
      { name: "to", value: NAMED },
      { name: "who", value: MEMBER, optional: true },
    ],
    summarize: () => "",
    compile: () => 1,
  },
]);

const slotAt = (line: string) => commandCompletionSlot(registry, line);

function argument(line: string) {
  const slot = slotAt(line);
  if (slot?.kind !== "argument") throw new Error(`no argument slot: ${line}`);
  return slot;
}

describe("command slots", () => {
  it("is the command word on a bare slash", () => {
    expect(slotAt("/")).toEqual({ kind: "command", from: 0, to: 1, typed: "" });
    expect(slotAt("/cl")).toMatchObject({ kind: "command", typed: "cl" });
  });

  it("is nothing for a command without arguments or an unknown one", () => {
    expect(slotAt("/close ")).toBeNull();
    expect(slotAt("/clsoe ")).toBeNull();
    expect(slotAt("say /label ")).toBeNull();
  });

  it("walks to the second and third arguments", () => {
    expect(argument("/route Todo ")).toMatchObject({
      index: 1,
      last: false,
      optional: false,
      from: 12,
      to: 12,
      typed: "",
    });
    expect(argument("/route Todo Done al")).toMatchObject({
      index: 2,
      last: true,
      optional: true,
      spec: MEMBER,
      from: 17,
      typed: "al",
    });
    expect(slotAt("/route Todo Done alice ")).toBeNull();
  });

  it("reads an argument through its quotes", () => {
    expect(argument("/route 'In Pr")).toMatchObject({
      index: 0,
      from: 7,
      typed: "In Pr",
    });
    expect(argument("/route 'In Progress' D")).toMatchObject({
      index: 1,
      typed: "D",
    });
  });

  it("is the raw remainder in a rest argument", () => {
    expect(argument("/label ")).toMatchObject({
      from: 7,
      typed: "",
      rest: true,
    });
    expect(argument("/label In Pro")).toMatchObject({
      from: 7,
      typed: "In Pro",
      rest: true,
      last: true,
    });
    expect(argument("/label Won't f")).toMatchObject({ typed: "Won't f" });
  });

  it("is a shell word in a rest argument that starts with a quote", () => {
    expect(argument('/label "In Pro')).toMatchObject({
      from: 7,
      typed: "In Pro",
      rest: false,
    });
    expect(slotAt('/label "In Progress" x')).toBeNull();
  });

  it("covers the current alternative in a multiple argument", () => {
    expect(argument("/assign {alice,b")).toMatchObject({
      from: 15,
      typed: "b",
      inBraces: true,
    });
    expect(argument("/assign {alice,'bot o")).toMatchObject({
      from: 15,
      typed: "bot o",
      inBraces: true,
    });
    expect(argument("/tag {In,No")).toMatchObject({
      from: 9,
      typed: "No",
      inBraces: true,
      rest: true,
    });
  });

  it("leaves braces ordinary in any other argument", () => {
    expect(argument("/route {To")).toMatchObject({
      from: 7,
      typed: "{To",
      inBraces: false,
    });
    expect(argument("/label {In,No")).toMatchObject({
      typed: "{In,No",
      inBraces: false,
    });
  });
});

describe("slot values", () => {
  const slot = (spec: ValueSpec) => ({ ...argument("/route "), spec });

  it("lists the enum set, then the specials, then the snapshot", () => {
    expect(
      slotValues(
        slot({ kind: "enum", values: ["open", "closed"], special: ["any"] }),
      ),
    ).toEqual([{ value: "open" }, { value: "closed" }, { value: "any" }]);
    expect(
      slotValues(slot(MEMBER), { options: [{ value: "alice", hint: "A" }] }),
    ).toEqual([{ value: "@me" }, { value: "alice", hint: "A" }]);
    expect(slotValues(slot(MEMBER), { options: undefined })).toEqual([
      { value: "@me" },
    ]);
  });

  it("asks for a fetch from a search provider, then merges its answer", () => {
    const provider = { search: async () => [] };
    expect(slotValues(slot(MEMBER), provider)).toBe("fetch");
    expect(slotValues(slot(MEMBER), provider, [{ value: "bot-one" }])).toEqual([
      { value: "@me" },
      { value: "bot-one" },
    ]);
  });

  it("filters by prefix, case-insensitively", () => {
    expect(
      filterOptions(
        [{ value: "Todo" }, { value: "In Progress" }, { value: "todo-later" }],
        "TO",
      ).map((o) => o.value),
    ).toEqual(["Todo", "todo-later"]);
  });
});

describe("argument quoting", () => {
  it("spells a shell word, except in a raw rest remainder", () => {
    expect(quoteArgument(argument("/route "), "In Progress")).toBe(
      "'In Progress'",
    );
    expect(quoteArgument(argument("/route "), "Won't fix")).toBe(
      '"Won\'t fix"',
    );
    expect(quoteArgument(argument("/assign {alice,"), "a,b")).toBe("'a,b'");
    expect(quoteArgument(argument("/label "), "In Progress")).toBe(
      "In Progress",
    );
  });
});
