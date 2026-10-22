import { describe, expect, it } from "vitest";
import {
  defineQuerySchema,
  parseQuery,
  type QueryFilter,
  queryFilters,
  queryTerms,
  quoteQueryValue,
} from "../src/query.ts";
import { canonicalValue, specialValue } from "../src/values.ts";
import { type TodouKey, todouSchema } from "./fixtures/todou-schema.ts";

// Ported from todou's search-query tests at 2fca674. The helpers below keep
// todou's names so every case's assertions read exactly as they did there.
const parseSearchQuery = (q: string) => parseQuery(todouSchema, q);
const terms = (q: string): string[] => queryTerms(parseSearchQuery(q));
const filters = (q: string): QueryFilter[] => queryFilters(parseSearchQuery(q));
const canonicalQualifierValue = (key: TodouKey, raw: string) =>
  canonicalValue(todouSchema.qualifiers[key].value, raw);
const isSpecialQualifierValue = (key: TodouKey, raw: string) =>
  specialValue(todouSchema.qualifiers[key].value, raw) !== null;

/**
 * The exact cases `parseSearchTerms` carried in the server before the parser
 * moved here. Every expectation is unchanged: this group is what proves the
 * qualifier grammar did not quietly alter how a plain query splits.
 */
describe("free-text scanning, unchanged", () => {
  it("splits on whitespace", () => {
    expect(terms("  a\tb\nc ")).toEqual(["a", "b", "c"]);
  });

  it("keeps a quoted phrase whole", () => {
    expect(terms('a "b c" d')).toEqual(["a", "b c", "d"]);
  });

  it("runs an unclosed quote to the end", () => {
    expect(terms('a "b c')).toEqual(["a", "b c"]);
  });

  it("drops an empty quoted term", () => {
    expect(terms('a "" b')).toEqual(["a", "b"]);
  });

  it("ends a bare term at a quote", () => {
    expect(terms('ab"cd"')).toEqual(["ab", "cd"]);
  });

  it("yields no terms at all for a query made of empty quotes", () => {
    // Rejecting this is the server's job now — the parser is pure.
    expect(terms('  ""  ')).toEqual([]);
    expect(filters('  ""  ')).toEqual([]);
  });
});

describe("qualifiers", () => {
  it("reads a key, a colon and a value", () => {
    expect(filters("harness:codex")).toEqual([
      { key: "harness", negated: false, values: ["codex"] },
    ]);
    expect(terms("harness:codex")).toEqual([]);
  });

  it("lets a value carry colons, which is what label names do here", () => {
    expect(filters("label:area:web")).toEqual([
      { key: "label", negated: false, values: ["area:web"] },
    ]);
  });

  it("leaves an unknown key as plain text", () => {
    expect(terms("foo:bar")).toEqual(["foo:bar"]);
    expect(filters("foo:bar")).toEqual([]);
    expect(terms("https://example.com/x")).toEqual(["https://example.com/x"]);
    expect(filters("https://example.com/x")).toEqual([]);
    expect(terms("12:30")).toEqual(["12:30"]);
  });

  it("takes a quoted run as text even when it spells a known key", () => {
    expect(terms('"harness:"')).toEqual(["harness:"]);
    expect(filters('"harness:"')).toEqual([]);
  });

  it("reads a leading minus as negation and commas as several values", () => {
    expect(filters("-label:a,b")).toEqual([
      { key: "label", negated: true, values: ["a", "b"] },
    ]);
  });

  it("keeps a quoted value whole, colons and spaces included", () => {
    expect(filters('label:"kind:bug"')).toEqual([
      { key: "label", negated: false, values: ["kind:bug"] },
    ]);
    expect(filters('status:"In Progress"')).toEqual([
      { key: "status", negated: false, values: ["In Progress"] },
    ]);
  });

  it("accepts an empty value without complaint and without a condition", () => {
    expect(filters("status:")).toEqual([
      { key: "status", negated: false, values: [] },
    ]);
    expect(terms("status:")).toEqual([]);
  });

  it("is case-insensitive in the key and preserves the value's case", () => {
    expect(filters("Status:NEXT")).toEqual([
      { key: "status", negated: false, values: ["NEXT"] },
    ]);
    expect(filters("HARNESS:Codex")).toEqual([
      { key: "harness", negated: false, values: ["Codex"] },
    ]);
  });

  it("takes CJK values", () => {
    expect(filters("label:前端,后端")).toEqual([
      { key: "label", negated: false, values: ["前端", "后端"] },
    ]);
  });

  it("ends a bare value at a quote, which then opens a term", () => {
    // Recorded rather than desired: the quote closes the value list, and the
    // main scan picks the rest up as a quoted run.
    expect(filters('label:a"b')).toEqual([
      { key: "label", negated: false, values: ["a"] },
    ]);
    expect(terms('label:a"b')).toEqual(["b"]);
  });

  it("repeats a key without merging the expressions", () => {
    expect(filters("label:a label:b")).toEqual([
      { key: "label", negated: false, values: ["a"] },
      { key: "label", negated: false, values: ["b"] },
    ]);
  });

  it("mixes qualifiers and free text in one query", () => {
    const q = "harness:codex is:comment 部署";
    expect(terms(q)).toEqual(["部署"]);
    expect(filters(q)).toEqual([
      { key: "harness", negated: false, values: ["codex"] },
      { key: "is", negated: false, values: ["comment"] },
    ]);
  });

  it("does not read a doubled minus as a qualifier", () => {
    expect(terms("--label:a")).toEqual(["--label:a"]);
  });
});

describe("part offsets", () => {
  const cases = [
    "  a\tb\nc ",
    'a "b c" d',
    'ab"cd"',
    "harness:codex is:comment 部署",
    '-label:"kind:bug",area:web 慢',
    "status:",
    'label:a"b',
    "--label:a https://example.com",
  ];

  it("tiles the whole query with parts that slice back to their source", () => {
    for (const q of cases) {
      const parts = parseSearchQuery(q);
      let at = 0;
      for (const part of parts) {
        expect(part.start).toBe(at);
        if (part.kind !== "space")
          expect(q.slice(part.start, part.end)).toBe(part.raw);
        at = part.end;
      }
      expect(at).toBe(q.length);
    }
  });

  it("points keyStart/keyEnd at the key as typed", () => {
    const [part] = parseSearchQuery("-Label:a");
    if (part?.kind !== "filter") throw new Error("expected a filter");
    expect("-Label:a".slice(part.keyStart, part.keyEnd)).toBe("Label");
    expect(part.key).toBe("label");
  });

  it("reads `meta:` as the metadata key, under its canonical spelling", () => {
    expect(filters("meta:orch/phase=spec")).toEqual([
      { key: "metadata", negated: false, values: ["orch/phase=spec"] },
    ]);
    expect(filters("-META:orch")).toEqual([
      { key: "metadata", negated: true, values: ["orch"] },
    ]);
  });

  it("keeps a metadata value whole, `=` and spaces included", () => {
    expect(filters('metadata:"ci/last-run=a b"')).toEqual([
      { key: "metadata", negated: false, values: ["ci/last-run=a b"] },
    ]);
    expect(filters("metadata:orch/note=a=b")).toEqual([
      { key: "metadata", negated: false, values: ["orch/note=a=b"] },
    ]);
  });

  it("points each value span at its own source slice, quotes included", () => {
    const q = '-label:"kind:bug",area:web';
    const [part] = parseSearchQuery(q);
    if (part?.kind !== "filter") throw new Error("expected a filter");
    expect(part.values.map((v) => q.slice(v.start, v.end))).toEqual([
      '"kind:bug"',
      "area:web",
    ]);
    expect(part.values.map((v) => v.value)).toEqual(["kind:bug", "area:web"]);
  });
});

describe("closed-set values", () => {
  it("folds the plural spellings `--in` uses onto the canonical ones", () => {
    expect(canonicalQualifierValue("is", "issues")).toBe("body");
    expect(canonicalQualifierValue("is", "Issue")).toBe("body");
    expect(canonicalQualifierValue("is", "comments")).toBe("comment");
    expect(canonicalQualifierValue("is", "SPECS")).toBe("spec");
    expect(canonicalQualifierValue("is", "pr")).toBeNull();
  });

  it("resolves states and rejects anything else", () => {
    expect(canonicalQualifierValue("state", "OPEN")).toBe("open");
    expect(canonicalQualifierValue("state", "opne")).toBeNull();
  });

  it("answers null for keys whose values live in the project", () => {
    expect(canonicalQualifierValue("label", "area:web")).toBeNull();
    expect(canonicalQualifierValue("harness", "codex")).toBeNull();
  });

  it("knows the values that stand for themselves", () => {
    expect(isSpecialQualifierValue("assignee", "@me")).toBe(true);
    expect(isSpecialQualifierValue("harness", "None")).toBe(true);
    expect(isSpecialQualifierValue("harness", "codex")).toBe(false);
    expect(isSpecialQualifierValue("label", "none")).toBe(false);
  });
});

describe("plain mode", () => {
  it("keeps a backslash an ordinary character", () => {
    expect(terms("C:\\temp a\\ b")).toEqual(["C:\\temp", "a\\", "b"]);
    expect(terms('\\"x y"')).toEqual(["\\", "x y"]);
    expect(filters("label:a\\,b")).toEqual([
      { key: "label", negated: false, values: ["a\\", "b"] },
    ]);
  });

  it("leaves braces literal when the schema does not opt in", () => {
    expect(filters("label:area:{web,ui}")).toEqual([
      { key: "label", negated: false, values: ["area:{web", "ui}"] },
    ]);
  });

  it("quotes a value that would not survive being read back", () => {
    expect(quoteQueryValue(todouSchema, "kind:bug")).toBe("kind:bug");
    expect(quoteQueryValue(todouSchema, "In Progress")).toBe('"In Progress"');
    expect(quoteQueryValue(todouSchema, "a,b")).toBe('"a,b"');
    expect(quoteQueryValue(todouSchema, 'say "hi"')).toBe('"say hi"');
    expect(quoteQueryValue(todouSchema, "{draft}")).toBe("{draft}");
  });

  it("reports a filter under the schema's spelling of its key", () => {
    const schema = defineQuerySchema({
      qualifiers: { Owner: { value: { kind: "free" } } },
    });
    const [part] = parseQuery(schema, "owner:alice");
    expect(part?.kind === "filter" && part.key).toBe("Owner");
  });
});

describe("defineQuerySchema", () => {
  const free = { value: { kind: "free" } } as const;

  it("throws on a key that is not a spelling a query can carry", () => {
    expect(() => defineQuerySchema({ qualifiers: { "1st": free } })).toThrow(
      /1st/,
    );
    expect(() => defineQuerySchema({ qualifiers: { "a:b": free } })).toThrow();
    expect(() =>
      defineQuerySchema({
        qualifiers: { ok: { ...free, keyAliases: ["-x"] } },
      }),
    ).toThrow(/-x/);
  });

  it("throws when two keys share a spelling, case-insensitively", () => {
    expect(() =>
      defineQuerySchema({ qualifiers: { label: free, Label: free } }),
    ).toThrow(/already/);
    expect(() =>
      defineQuerySchema({
        qualifiers: { label: free, tag: { ...free, keyAliases: ["LABEL"] } },
      }),
    ).toThrow(/already/);
  });

  it("throws on an enum alias naming a value outside the set", () => {
    expect(() =>
      defineQuerySchema({
        qualifiers: {
          state: {
            value: {
              kind: "enum",
              values: ["open", "closed"],
              aliases: { done: "finished" },
            },
          },
        },
      }),
    ).toThrow(/finished/);
  });

  it("precomputes the spellings and keeps the defaults", () => {
    expect(todouSchema.keys).toEqual([
      "is",
      "state",
      "status",
      "label",
      "assignee",
      "harness",
      "session",
      "metadata",
    ]);
    expect(todouSchema.spellings.get("meta")).toBe("metadata");
    expect(todouSchema.escapes).toBe("plain");
    expect(todouSchema.braces).toBe(false);
  });
});
