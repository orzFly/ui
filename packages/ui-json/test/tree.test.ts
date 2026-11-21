import { describe, expect, it } from "vitest";
import { parseJson } from "../src/parse.ts";
import {
  ancestorsOf,
  childPath,
  collectExpandable,
  flatten,
  type JsonNodeRow,
  type JsonRow,
  PREVIEW_LIMIT,
  pathSegments,
  ROW_BUDGET,
  resolvePath,
  SEARCH_BUDGET,
  searchPaths,
  WRAP_PREVIEW_LIMIT,
} from "../src/tree.ts";
import type { JsonDocument } from "../src/types.ts";
import { parseYaml } from "../src/yaml.ts";

const none = new Set<string>();
const paths = (rows: JsonRow[]) => rows.map((row) => row.path);
const node = (rows: JsonRow[], path: string) =>
  rows.find((row) => row.path === path) as JsonNodeRow;

function doc(text: string): JsonDocument {
  const result = parseJson(text, { dialect: "jsonc" });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
}

describe("flatten", () => {
  it("hides a non-empty root container and starts its members at depth 0", () => {
    const { rows } = flatten({ a: 1, b: [1, 2] }, { expanded: none });
    expect(paths(rows)).toEqual(["$.a", "$.b"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 0]);
    expect(node(rows, "$.b").preview).toBe("[2 items]");
  });

  it("shows a scalar or empty root as one row", () => {
    expect(paths(flatten(42, { expanded: none }).rows)).toEqual(["$"]);
    const empty = flatten({}, { expanded: none }).rows;
    expect(node(empty, "$").preview).toBe("{}");
  });

  it("lists an expanded container's children, and drops `{…}` once it is open", () => {
    const value = { o: { x: 1, "odd key": [true] } };
    const { rows } = flatten(value, {
      expanded: new Set(["$.o", '$.o["odd key"]']),
    });
    expect(paths(rows)).toEqual([
      "$.o",
      "$.o.x",
      '$.o["odd key"]',
      '$.o["odd key"][0]',
    ]);
    expect(node(rows, "$.o").preview).toBe("");
    expect(node(rows, '$.o["odd key"][0]').depth).toBe(2);
  });

  it("names a collapsed array's length through the items label", () => {
    const { rows } = flatten(
      { list: [1, 2, 3] },
      { expanded: none, items: (n) => `[${n} 项]` },
    );
    expect(node(rows, "$.list").preview).toBe("[3 项]");
  });

  it("cuts long strings at 160, or 1000 under wrap, never inside a surrogate pair", () => {
    const long = "a".repeat(2000);
    const { rows } = flatten({ s: long }, { expanded: none });
    const row = node(rows, "$.s");
    expect(row.truncated).toBe(true);
    expect(row.preview).toBe(`${"a".repeat(PREVIEW_LIMIT)}…`);
    const wrapped = node(
      flatten({ s: long }, { expanded: none, previewLimit: WRAP_PREVIEW_LIMIT })
        .rows,
      "$.s",
    );
    expect(wrapped.preview.length).toBe(WRAP_PREVIEW_LIMIT + 1);

    const split = `${"a".repeat(PREVIEW_LIMIT - 1)}😀tail`;
    const cut = node(flatten({ s: split }, { expanded: none }).rows, "$.s");
    expect(cut.preview).toBe(`${"a".repeat(PREVIEW_LIMIT - 1)}…`);
  });

  it("stops at the row budget and says so", () => {
    const value = Array.from({ length: ROW_BUDGET + 10 }, (_, i) => i);
    const result = flatten(value, { expanded: none });
    expect(result.limited).toBe(true);
    expect(result.rows.length).toBe(ROW_BUDGET);
  });

  it("shows a literal in place of the value's own text", () => {
    const parsed = parseJson("{n: 0x1F, s: 'q'}", { dialect: "json5" });
    if (!parsed.ok) throw new Error();
    const { rows } = flatten(parsed.document.value, {
      expanded: none,
      facts: parsed.document.facts,
    });
    expect(node(rows, "$.n").preview).toBe("0x1F");
    expect(node(rows, "$.s").preview).toBe("'q'");
  });

  it("calls the summary on collapsed non-empty objects only", () => {
    const seen: unknown[] = [];
    const summary = (record: Record<string, unknown>) => {
      seen.push(record);
      return {
        tags: [{ key: "type", text: "x" }],
        name: null,
        args: null,
        text: null,
      };
    };
    const value = { a: { type: "x" }, b: {}, c: { type: "y" } };
    const { rows } = flatten(value, { expanded: new Set(["$.c"]), summary });
    expect(seen).toEqual([value.a]);
    expect(node(rows, "$.a").summary?.tags[0]?.text).toBe("x");
    expect(node(rows, "$.c").summary).toBeNull();
  });

  describe("comment rows", () => {
    const document = doc(`// head
{
  // about a
  "a": 1, // trailing
  "b": {
    /* two
       lines */
    "c": 2
    // end of b
  }
}`);

    it("puts leading comments before their member and dangling ones after the last child", () => {
      const { rows } = flatten(document.value, {
        expanded: new Set(["$.b"]),
        facts: document.facts,
      });
      expect(
        rows.map((row) =>
          row.kind === "comment"
            ? `${row.depth} ${row.text}`
            : `${row.depth} ${row.path}`,
        ),
      ).toEqual([
        "0 // head",
        "0 // about a",
        "0 $.a",
        "0 $.b",
        "1 /* two",
        "1 lines */",
        "1 $.b.c",
        "1 // end of b",
      ]);
      expect(rows[1]?.path).toBe("$.a#c0");
      expect(rows[4]).toMatchObject({ path: "$.b.c#c0", member: "$.b.c" });
      expect(rows[7]).toMatchObject({ path: "$.b#c0", member: "$.b" });
      expect(node(rows, "$.a").trailing).toBe("// trailing");
    });

    it("folds a container's comments away with it", () => {
      const { rows } = flatten(document.value, {
        expanded: none,
        facts: document.facts,
      });
      expect(paths(rows)).toEqual(["$#c0", "$.a#c0", "$.a", "$.b"]);
    });
  });
});

describe("searchPaths", () => {
  const value = {
    messages: [
      { role: "user", text: "hello" },
      { role: "bot", text: "bye" },
    ],
    meta: { owner: "claude-agent" },
  };

  it("keeps matches and their ancestors, and drops the rest", () => {
    const result = searchPaths(value, "bye");
    expect([...result.matched]).toEqual(["$.messages[1].text"]);
    const { rows } = flatten(value, {
      expanded: none,
      visible: result.visible,
    });
    expect(paths(rows)).toEqual([
      "$.messages",
      "$.messages[1]",
      "$.messages[1].text",
    ]);
  });

  it("keeps a matched container's whole subtree", () => {
    const result = searchPaths(value, "meta");
    const { rows } = flatten(value, {
      expanded: none,
      visible: result.visible,
    });
    expect(paths(rows)).toEqual(["$.meta", "$.meta.owner"]);
  });

  it("reads comments, and shows the line that matched", () => {
    const document = doc('{"a": 1, // keep me\n// find me\n"b": 2, "c": 3}');
    const result = searchPaths(document.value, "find", {
      facts: document.facts,
    });
    const { rows } = flatten(document.value, {
      expanded: none,
      visible: result.visible,
      facts: document.facts,
    });
    expect(paths(rows)).toEqual(["$.b#c0", "$.b"]);
    const trailing = searchPaths(document.value, "keep", {
      facts: document.facts,
    });
    expect(trailing.visible.has("$.a")).toBe(true);
    expect(trailing.matched.has("$.a#t")).toBe(true);
  });

  it("stops at its budget", () => {
    const big = Array.from({ length: 50 }, () => 0);
    expect(searchPaths(big, "x", { budget: 10 }).limited).toBe(true);
    expect(searchPaths(big, "x").limited).toBe(false);
    expect(SEARCH_BUDGET).toBeGreaterThan(ROW_BUDGET);
  });
});

describe("paths", () => {
  it("names ancestors without being fooled by quoted keys", () => {
    const path = childPath(childPath("$", 'a.b["c"', null), "d", null);
    expect(path).toBe('$["a.b[\\"c\\""].d');
    expect(ancestorsOf(path)).toEqual(["$", '$["a.b[\\"c\\""]']);
    expect(ancestorsOf("$.list[3].x")).toEqual(["$", "$.list", "$.list[3]"]);
  });

  it("reads a path back into its segments and resolves it", () => {
    expect(pathSegments('$.a[2]["b c"]')).toEqual(["a", 2, "b c"]);
    const value = { a: [0, 1, { "b c": "x" }] };
    expect(resolvePath(value, '$.a[2]["b c"]')).toMatchObject({
      found: true,
      value: "x",
      key: "b c",
    });
    expect(resolvePath(value, "$.a[9]").found).toBe(false);
    expect(resolvePath(value, "$.nope").found).toBe(false);
  });
});

describe("collectExpandable", () => {
  it("collects every non-empty container, up to a limit", () => {
    const value = { a: { b: { c: [] } }, d: [1, [2]] };
    expect(collectExpandable(value, "$", 100).paths).toEqual([
      "$",
      "$.a",
      "$.a.b",
      "$.d",
      "$.d[1]",
    ]);
    const cut = collectExpandable(value, "$", 2);
    expect(cut).toEqual({ paths: ["$", "$.a"], limited: true });
  });
});

describe("YAML", () => {
  function yaml(text: string): JsonDocument {
    const result = parseYaml(text);
    if (!result.ok) throw new Error(result.error.message);
    return result.document;
  }
  const recursive = yaml("a: &x [1, *x]\nb: *x\n");

  it("draws a recursive alias as a leaf in every walk", () => {
    const { value, facts } = recursive;
    const { rows } = flatten(value, {
      expanded: new Set(["$.a", "$.b"]),
      facts,
    });
    expect(paths(rows)).toEqual([
      "$.a",
      "$.a[0]",
      "$.a[1]",
      "$.b",
      "$.b[0]",
      "$.b[1]",
    ]);
    expect(node(rows, "$.a[1]")).toMatchObject({
      expandable: false,
      mark: "*x",
      anchorPath: "$.a",
    });
    expect(node(rows, "$.b").expandable).toBe(true);

    expect(collectExpandable(value, "$", 100, facts).paths).toEqual([
      "$",
      "$.a",
      "$.b",
    ]);

    const search = searchPaths(value, "1", { facts });
    expect(search.limited).toBe(false);
    expect([...search.matched].sort()).toEqual(
      ["$.a[0]", "$.a[1]", "$.b[0]", "$.b[1]"].sort(),
    );
  });

  it("writes each row's marks as YAML does", () => {
    const { value, facts } = yaml(
      "base: &defaults\n  k: v\nsum: &s !!binary aGk=\nthing: !thing x\nuse: *defaults\nplain: 1\n",
    );
    const { rows } = flatten(value, { expanded: none, facts });
    const mark = (path: string) => node(rows, path).mark;
    expect(mark("$.base")).toBe("&defaults");
    expect(mark("$.sum")).toBe("&s !!binary");
    expect(mark("$.thing")).toBe("!thing");
    expect(mark("$.use")).toBe("*defaults");
    expect(mark("$.plain")).toBeNull();
    expect(node(rows, "$.use").anchorPath).toBe("$.base");
    expect(node(rows, "$.base").anchorPath).toBeNull();
  });

  it("finds a mark as it finds a literal, on a container too", () => {
    const { value, facts } = yaml(
      "defaults: &defaults\n  k: v\nbuild:\n  <<: *defaults\nother: 1\n",
    );
    const { matched } = searchPaths(value, "defaults", { facts });
    expect(matched.has("$.defaults")).toBe(true);
    expect(matched.has('$.build["<<"]')).toBe(true);
    expect(matched.has("$.other")).toBe(false);
  });
});
