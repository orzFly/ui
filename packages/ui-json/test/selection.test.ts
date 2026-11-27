import { describe, expect, it } from "vitest";
import { parseJson } from "../src/parse.ts";
import {
  extendVertical,
  liftMembers,
  moveLeft,
  moveRight,
  moveToEnd,
  moveVertical,
  selectAll,
  selectionAfterCollapse,
  selectionExists,
  selectionRows,
  selectionSource,
  selectionText,
} from "../src/selection.ts";
import { flatten } from "../src/tree.ts";
import type { JsonDocument, JsonSelection, NodeFacts } from "../src/types.ts";
import { readYaml } from "../src/yaml-reader.ts";

const value = {
  model: "model-large",
  messages: [
    { role: "user", content: "hi" },
    { role: "assistant", content: [{ type: "text", text: "yo" }] },
  ],
  metadata: { user_id: "claude-agent", trace: null, tier: 2 },
};

const rowsOf = (expanded: string[]) =>
  flatten(value, { expanded: new Set(expanded) }).rows;

const members = (anchor: string, focus = anchor): JsonSelection => ({
  type: "members",
  anchor,
  focus,
});

describe("liftMembers", () => {
  it("raises both ends to siblings under their deepest common parent", () => {
    expect(
      liftMembers("$.messages[0].role", "$.messages[1].content[0]"),
    ).toEqual(members("$.messages[0]", "$.messages[1]"));
    expect(liftMembers("$.model", "$.metadata.tier")).toEqual(
      members("$.model", "$.metadata"),
    );
  });

  it("makes an ancestor and its descendant the ancestor alone", () => {
    expect(liftMembers("$.messages", "$.messages[1].role")).toEqual(
      members("$.messages"),
    );
    expect(liftMembers("$.metadata.tier", "$.metadata")).toEqual(
      members("$.metadata"),
    );
  });
});

describe("keyboard moves", () => {
  const rows = rowsOf(["$.messages", "$.messages[0]", "$.metadata"]);

  it("keeps the key column where a row has a key, and turns it into the value on an item", () => {
    expect(moveVertical(rows, { type: "key", path: "$.model" }, 1)).toEqual({
      type: "key",
      path: "$.messages",
    });
    expect(moveVertical(rows, { type: "key", path: "$.messages" }, 1)).toEqual({
      type: "value",
      path: "$.messages[0]",
    });
    expect(
      moveVertical(rows, { type: "value", path: "$.messages[0]" }, 1),
    ).toEqual({ type: "value", path: "$.messages[0].role" });
  });

  it("moves a range down past its subtree, as the member it lands on", () => {
    expect(moveVertical(rows, members("$.messages[0]"), 1)).toEqual(
      members("$.messages[1]"),
    );
    expect(moveVertical(rows, members("$.messages"), -1)).toEqual(
      members("$.model"),
    );
  });

  it("starts at the first row and stays put at either end", () => {
    expect(moveVertical(rows, null, 1)).toEqual({
      type: "value",
      path: "$.model",
    });
    expect(moveVertical(rows, { type: "value", path: "$.model" }, -1)).toEqual({
      type: "value",
      path: "$.model",
    });
  });

  it("extends a range among siblings with Shift", () => {
    const once = extendVertical(rows, { type: "value", path: "$.model" }, 1);
    expect(once).toEqual(members("$.model", "$.messages"));
    const twice = extendVertical(rows, once, 1);
    expect(twice).toEqual(members("$.model", "$.metadata"));
    expect(extendVertical(rows, members("$.messages[1]"), -1)).toEqual(
      members("$.messages[1]", "$.messages[0]"),
    );
  });

  it("goes right from a key to its value, and into an open container", () => {
    expect(moveRight(rows, { type: "key", path: "$.metadata" })).toEqual({
      type: "value",
      path: "$.metadata",
    });
    expect(moveRight(rows, { type: "value", path: "$.metadata" })).toEqual({
      type: "key",
      path: "$.metadata.user_id",
    });
    expect(moveRight(rows, { type: "value", path: "$.messages" })).toEqual({
      type: "value",
      path: "$.messages[0]",
    });
  });

  it("goes left from a value to its key, and from a key or item to its parent", () => {
    expect(moveLeft(rows, { type: "value", path: "$.metadata.tier" })).toEqual({
      type: "key",
      path: "$.metadata.tier",
    });
    expect(moveLeft(rows, { type: "key", path: "$.metadata.tier" })).toEqual(
      members("$.metadata"),
    );
    expect(moveLeft(rows, { type: "value", path: "$.messages[1]" })).toEqual(
      members("$.messages"),
    );
  });

  it("goes to the first and last row, and selects the root", () => {
    expect(
      moveToEnd(rows, { type: "key", path: "$.messages" }, "last"),
    ).toEqual({ type: "key", path: "$.metadata.tier" });
    expect(moveToEnd(rows, null, "first")).toEqual({
      type: "value",
      path: "$.model",
    });
    expect(selectAll()).toEqual({ type: "value", path: "$" });
  });
});

describe("selectionRows", () => {
  const rows = rowsOf(["$.messages", "$.metadata"]);
  const at = (path: string) => rows.findIndex((row) => row.path === path);

  it("steps a value block: its own row from the value, then its subtree", () => {
    expect(selectionRows(rows, { type: "value", path: "$.metadata" })).toEqual({
      kind: "value",
      first: at("$.metadata"),
      last: at("$.metadata.tier"),
      depth: 1,
      ownRow: true,
    });
  });

  it("runs a range from its first member to its last member's last descendant", () => {
    expect(selectionRows(rows, members("$.metadata", "$.messages"))).toEqual({
      kind: "members",
      first: at("$.messages"),
      last: at("$.metadata.tier"),
      depth: 0,
      ownRow: false,
    });
  });

  it("covers a member's leading comments", () => {
    const parsed = parseJson('{"a": 1,\n// about b\n"b": 2}', {
      dialect: "jsonc",
    });
    if (!parsed.ok) throw new Error();
    const commented = flatten(parsed.document.value, {
      expanded: new Set(),
      facts: parsed.document.facts,
    }).rows;
    expect(selectionRows(commented, members("$.b"))).toMatchObject({
      first: 1,
      last: 2,
    });
  });

  it("covers every row for the hidden root", () => {
    expect(selectionRows(rows, selectAll())).toMatchObject({
      first: 0,
      last: rows.length - 1,
      ownRow: false,
    });
  });
});

describe("selectionAfterCollapse", () => {
  it("moves a selection inside the collapsed container to its member", () => {
    expect(
      selectionAfterCollapse(
        { type: "key", path: "$.metadata.tier" },
        "$.metadata",
      ),
    ).toEqual(members("$.metadata"));
    const outside: JsonSelection = { type: "value", path: "$.metadata" };
    expect(selectionAfterCollapse(outside, "$.metadata")).toBe(outside);
  });
});

describe("selectionExists", () => {
  it("drops a path that names nothing, and a key on an array item", () => {
    expect(selectionExists(value, { type: "value", path: "$.nope" })).toBe(
      false,
    );
    expect(selectionExists(value, { type: "key", path: "$.messages[0]" })).toBe(
      false,
    );
    expect(selectionExists(value, members("$.model", "$.metadata.tier"))).toBe(
      false,
    );
    expect(selectionExists(value, members("$.model", "$.metadata"))).toBe(true);
  });
});

describe("selectionText", () => {
  it("copies a key's text", () => {
    expect(
      selectionText(value, { type: "key", path: "$.metadata.user_id" }),
    ).toBe("user_id");
  });

  it("copies a string value raw and any other value as JSON", () => {
    expect(selectionText(value, { type: "value", path: "$.model" })).toBe(
      "model-large",
    );
    expect(selectionText(value, { type: "value", path: "$.metadata" })).toBe(
      JSON.stringify(value.metadata, null, 2),
    );
    expect(
      selectionText(
        value,
        { type: "value", path: "$.metadata" },
        { compact: true },
      ),
    ).toBe(JSON.stringify(value.metadata));
  });

  it("copies an object's members as key lines", () => {
    expect(
      selectionText(value, members("$.metadata.user_id", "$.metadata.trace")),
    ).toBe('"user_id": "claude-agent",\n"trace": null,');
  });

  it("copies one array item bare and several as item lines", () => {
    expect(selectionText(value, members("$.messages[0]"))).toBe(
      JSON.stringify(value.messages[0], null, 2),
    );
    expect(
      selectionText(value, members("$.messages[1]", "$.messages[0]"), {
        compact: true,
      }),
    ).toBe(
      `${JSON.stringify(value.messages[0])},\n${JSON.stringify(value.messages[1])},`,
    );
  });

  it("copies the whole document for the root", () => {
    expect(selectionText(value, members("$"))).toBe(
      JSON.stringify(value, null, 2),
    );
    expect(
      selectionText({ value, source: "{}" }, selectAll(), { compact: true }),
    ).toBe(JSON.stringify(value));
  });

  it("gives null for what cannot be serialised", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(
      selectionText({ a: cycle }, { type: "value", path: "$.a" }),
    ).toBeNull();
  });
});

describe("selectionSource", () => {
  const text = `{
  // the model
  model: 'model-large', // pinned
  /* the turns */
  turns: [1, 0x2],
  tier: 2,
}`;
  const parsed = parseJson(text, { dialect: "json5" });
  const document = (parsed.ok ? parsed.document : undefined) as JsonDocument;

  it("slices a value as written", () => {
    expect(
      selectionSource(document, { type: "value", path: "$.turns[1]" }),
    ).toBe("0x2");
    expect(selectionSource(document, { type: "value", path: "$" })).toBe(text);
  });

  it("slices a range from its first leading comment, comments kept, indent taken off", () => {
    expect(selectionSource(document, members("$.model", "$.turns"))).toBe(
      "// the model\nmodel: 'model-large', // pinned\n/* the turns */\nturns: [1, 0x2]",
    );
  });

  it("takes a JSON member's indent off its later lines", () => {
    const json =
      '{\n  "a": {\n    "b": {\n      "c": 1,\n      "d": [\n        2\n      ]\n    }\n  }\n}';
    const result = parseJson(json);
    const doc = (result.ok ? result.document : undefined) as JsonDocument;
    expect(selectionSource(doc, { type: "value", path: "$.a.b" })).toBe(
      '{\n  "c": 1,\n  "d": [\n    2\n  ]\n}',
    );
    expect(selectionSource(doc, members("$.a.b"))).toBe(
      '"b": {\n  "c": 1,\n  "d": [\n    2\n  ]\n}',
    );
  });

  it("takes a line indented less only what it has", () => {
    const json = '{\n    "a": [1,\n  2,\n\t\t3]\n}';
    const result = parseJson(json);
    const doc = (result.ok ? result.document : undefined) as JsonDocument;
    expect(selectionSource(doc, members("$.a"))).toBe('"a": [1,\n2,\n3]');
  });
});

describe("selectionSource over YAML", () => {
  const text = `root:
  build:
    # the steps
    script: |
      pnpm install
        --frozen
      pnpm build
    env:
      - CI=true
      - key: value
        other: 2
`;
  const parsed = readYaml(text);
  const document = (parsed.ok ? parsed.document : undefined) as JsonDocument;

  it("copies a block member as YAML that pastes at the start of a line", () => {
    expect(selectionSource(document, members("$.root.build"))).toBe(
      "build:\n  # the steps\n  script: |\n    pnpm install\n      --frozen\n    pnpm build\n  env:\n    - CI=true\n    - key: value\n      other: 2",
    );
  });

  it("keeps a block scalar's lines indented relative to its member", () => {
    expect(selectionSource(document, members("$.root.build.script"))).toBe(
      "# the steps\nscript: |\n  pnpm install\n    --frozen\n  pnpm build",
    );
  });

  it("copies a block sequence item from its dash", () => {
    expect(selectionSource(document, members("$.root.build.env[1]"))).toBe(
      "- key: value\n  other: 2",
    );
  });

  it("has nothing without a source, or for a key", () => {
    expect(selectionSource({ value }, members("$.model"))).toBeUndefined();
    expect(
      selectionSource(document, { type: "key", path: "$.model" }),
    ).toBeUndefined();
  });
});

describe("selectionSource over parts", () => {
  const text = `title = "t"

# the server
[server]
port = 1

[log]
level = 2

[server.tls]
on = true
`;
  const span = (snippet: string): [number, number] => {
    const start = text.indexOf(snippet);
    return [start, start + snippet.length];
  };
  const first = span("[server]\nport = 1");
  const second = span("[server.tls]\non = true");
  const server: NodeFacts = {
    range: [first[0], second[1]],
    memberRange: [first[0], second[1]],
    parts: [first, second],
    leading: [
      { text: "# the server", block: false, range: span("# the server") },
    ],
  };
  const root = {
    title: "t",
    server: { port: 1, tls: { on: true } },
    log: { level: 2 },
  };
  const table = new Map<string, NodeFacts>([
    ["title", { range: span('"t"'), memberRange: span('title = "t"') }],
    ["server", server],
    [
      "log",
      {
        range: span("[log]\nlevel = 2"),
        memberRange: span("[log]\nlevel = 2"),
      },
    ],
  ]);
  const document: JsonDocument = {
    value: root,
    source: text,
    facts: (container, key) =>
      container === null
        ? { range: [0, text.length] }
        : container === root
          ? table.get(String(key))
          : undefined,
  };

  it("copies a scattered value's places, a blank line between them", () => {
    expect(selectionSource(document, { type: "value", path: "$.server" })).toBe(
      "[server]\nport = 1\n\n[server.tls]\non = true",
    );
  });

  it("copies a scattered member from its leading comment", () => {
    expect(selectionSource(document, members("$.server"))).toBe(
      "# the server\n[server]\nport = 1\n\n[server.tls]\non = true",
    );
  });

  it("copies a run where one member is scattered, leaving out what lies between", () => {
    // `[log]` stands between `server`'s places and is not in the run.
    expect(selectionSource(document, members("$.title", "$.server"))).toBe(
      'title = "t"\n\n# the server\n[server]\nport = 1\n\n[server.tls]\non = true',
    );
  });

  it("keeps places that touch as one slice, in source order", () => {
    expect(selectionSource(document, members("$.server", "$.log"))).toBe(
      "# the server\n[server]\nport = 1\n\n[log]\nlevel = 2\n\n[server.tls]\non = true",
    );
  });

  it("copies a run without parts as one slice", () => {
    expect(selectionSource(document, members("$.log"))).toBe(
      "[log]\nlevel = 2",
    );
  });
});
