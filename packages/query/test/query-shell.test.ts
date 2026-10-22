import { describe, expect, it } from "vitest";
import {
  type CompiledQuerySchema,
  defineQuerySchema,
  parseQuery,
  type QueryFilter,
  type QueryPart,
  queryFilters,
  queryTerms,
  quoteQueryValue,
} from "../src/query.ts";
import { todouQualifiers } from "./fixtures/todou-schema.ts";

const shell = defineQuerySchema({ ...todouQualifiers, escapes: "shell" });
const shellBraces = defineQuerySchema({
  ...todouQualifiers,
  escapes: "shell",
  braces: true,
});
const plainBraces = defineQuerySchema({ ...todouQualifiers, braces: true });

const termsIn =
  (schema: CompiledQuerySchema) =>
  (q: string): string[] =>
    queryTerms(parseQuery(schema, q));
const filtersIn =
  (schema: CompiledQuerySchema) =>
  (q: string): QueryFilter[] =>
    queryFilters(parseQuery(schema, q));

function filterPart(schema: CompiledQuerySchema, q: string) {
  const part = parseQuery(schema, q).find((p) => p.kind === "filter");
  if (part?.kind !== "filter") throw new Error("expected a filter");
  return part;
}

describe("shell mode", () => {
  const terms = termsIn(shell);
  const filters = filtersIn(shell);

  it("joins adjacent quoted and bare segments into one term", () => {
    expect(terms('ab"cd ef"')).toEqual(["abcd ef"]);
    expect(terms("a'b c'd e")).toEqual(["ab cd", "e"]);
  });

  it("reads backslashes and quotes the shell way", () => {
    expect(terms("C:\\\\temp")).toEqual(["C:\\temp"]);
    expect(terms("don\\'t")).toEqual(["don't"]);
    expect(terms(`"don't"`)).toEqual(["don't"]);
    expect(terms('"say \\"hi\\""')).toEqual(['say "hi"']);
    expect(terms("a\\ b")).toEqual(["a b"]);
  });

  it("drops an empty quoted term", () => {
    expect(terms(`a '' "" b`)).toEqual(["a", "b"]);
  });

  it("reads a qualifier only when `key:` is bare at the start of a word", () => {
    expect(filters("label:x")).toEqual([
      { key: "label", negated: false, values: ["x"] },
    ]);
    expect(terms('"label:x"')).toEqual(["label:x"]);
    expect(filters('"label:x"')).toEqual([]);
    expect(terms("label\\:x")).toEqual(["label:x"]);
    expect(filters("label\\:x")).toEqual([]);
    expect(terms("'-'label:x")).toEqual(["-label:x"]);
  });

  it("keeps todou's key rules: unknown keys, case, negation, doubled minus", () => {
    expect(terms("foo:bar https://app.example/x 12:30")).toEqual([
      "foo:bar",
      "https://app.example/x",
      "12:30",
    ]);
    expect(filters("-Label:a,b")).toEqual([
      { key: "label", negated: true, values: ["a", "b"] },
    ]);
    expect(filters("META:orch")).toEqual([
      { key: "metadata", negated: false, values: ["orch"] },
    ]);
    expect(terms("--label:a")).toEqual(["--label:a"]);
    expect(filters("label:前端,后端")).toEqual([
      { key: "label", negated: false, values: ["前端", "后端"] },
    ]);
  });

  it("splits values only at bare commas", () => {
    expect(filters("label:'a,b'")).toEqual([
      { key: "label", negated: false, values: ["a,b"] },
    ]);
    expect(filters("label:a\\,b")).toEqual([
      { key: "label", negated: false, values: ["a,b"] },
    ]);
    expect(filters('label:x,"y,z"w')).toEqual([
      { key: "label", negated: false, values: ["x", "y,zw"] },
    ]);
    expect(filters('status:"In Progress"')).toEqual([
      { key: "status", negated: false, values: ["In Progress"] },
    ]);
  });

  it("drops empty values, as plain mode does", () => {
    expect(filters("status:")).toEqual([
      { key: "status", negated: false, values: [] },
    ]);
    expect(filters("label:a,,''")).toEqual([
      { key: "label", negated: false, values: ["a"] },
    ]);
  });

  it("points value spans at their source, quotes included", () => {
    const q = `-label:"kind:bug",area\\:web`;
    const part = filterPart(shell, q);
    expect(q.slice(part.keyStart, part.keyEnd)).toBe("label");
    expect(part.values.map((v) => v.raw)).toEqual(['"kind:bug"', "area\\:web"]);
    expect(part.values.map((v) => q.slice(v.start, v.end))).toEqual([
      '"kind:bug"',
      "area\\:web",
    ]);
    expect(part.values.map((v) => v.value)).toEqual(["kind:bug", "area:web"]);
  });

  it("runs an unclosed quote to the end of the query", () => {
    expect(terms('a "b c')).toEqual(["a", "b c"]);
    expect(terms("a 'b c")).toEqual(["a", "b c"]);
    expect(filters('status:"In Prog x')).toEqual([
      { key: "status", negated: false, values: ["In Prog x"] },
    ]);
  });

  it("quotes values with quoteShellWord", () => {
    for (const value of ["kind:bug", "In Progress", "a,b", "won't", "{x}"]) {
      const quoted = quoteQueryValue(shell, value);
      expect(filtersIn(shellBraces)(`label:${quoted}`)).toEqual([
        { key: "label", negated: false, values: [value] },
      ]);
    }
    expect(quoteQueryValue(shell, "kind:bug")).toBe("kind:bug");
    expect(quoteQueryValue(shell, "In Progress")).toBe("'In Progress'");
  });
});

describe("braces in values", () => {
  it("expands a group in plain mode and keeps the commas inside it", () => {
    expect(filtersIn(plainBraces)("label:area:{web,ui},kind:bug")).toEqual([
      {
        key: "label",
        negated: false,
        values: ["area:web", "area:ui", "kind:bug"],
      },
    ]);
    const part = filterPart(plainBraces, "label:area:{web,ui},kind:bug");
    expect(part.values.map((v) => v.raw)).toEqual([
      "area:{web,ui}",
      "kind:bug",
    ]);
    expect(part.values.map((v) => v.expanded)).toEqual([
      ["area:web", "area:ui"],
      ["kind:bug"],
    ]);
  });

  it("expands a group in shell mode", () => {
    expect(filtersIn(shellBraces)("label:area:{web,ui},kind:bug")).toEqual([
      {
        key: "label",
        negated: false,
        values: ["area:web", "area:ui", "kind:bug"],
      },
    ]);
    expect(filtersIn(shellBraces)("-label:{a,b{c,d}}")).toEqual([
      { key: "label", negated: true, values: ["a", "bc", "bd"] },
    ]);
  });

  it("keeps quoted and escaped braces and commas literal in shell mode", () => {
    const filters = filtersIn(shellBraces);
    expect(filters("label:'{a,b}'")).toEqual([
      { key: "label", negated: false, values: ["{a,b}"] },
    ]);
    expect(filters("label:\\{a,b\\}")).toEqual([
      { key: "label", negated: false, values: ["{a", "b}"] },
    ]);
    expect(filters("label:{'a,b',c}")).toEqual([
      { key: "label", negated: false, values: ["a,b", "c"] },
    ]);
    expect(filters("label:{a\\,b,c}")).toEqual([
      { key: "label", negated: false, values: ["a,b", "c"] },
    ]);
    expect(filters('status:{"In Progress",Done}')).toEqual([
      { key: "status", negated: false, values: ["In Progress", "Done"] },
    ]);
  });

  it("keeps a quoted value literal in plain mode", () => {
    expect(filtersIn(plainBraces)('label:"{a,b}"')).toEqual([
      { key: "label", negated: false, values: ["{a,b}"] },
    ]);
  });

  it("leaves unbalanced and comma-less braces as they are", () => {
    for (const schema of [plainBraces, shellBraces]) {
      const filters = filtersIn(schema);
      expect(filters("label:{a,b")).toEqual([
        { key: "label", negated: false, values: ["{a", "b"] },
      ]);
      expect(filters("label:{draft},x")).toEqual([
        { key: "label", negated: false, values: ["{draft}", "x"] },
      ]);
      expect(filters("label:{1..3}")).toEqual([
        { key: "label", negated: false, values: ["{1..3}"] },
      ]);
    }
  });

  it("does not let a group span a space or, in plain mode, a stray quote", () => {
    expect(filtersIn(plainBraces)("label:{a, b}")).toEqual([
      { key: "label", negated: false, values: ["{a"] },
    ]);
    expect(filtersIn(plainBraces)('label:{a"b",c}')).toEqual([
      { key: "label", negated: false, values: ["{a"] },
    ]);
  });

  it("reads a quoted alternative in plain mode as one, spaces and all", () => {
    expect(filtersIn(plainBraces)('label:{a,"b c"}')).toEqual([
      { key: "label", negated: false, values: ["a", "b c"] },
    ]);
    expect(termsIn(plainBraces)('label:{a,"b c"}')).toEqual([]);
    expect(filtersIn(plainBraces)('label:{"x,}",y}')).toEqual([
      { key: "label", negated: false, values: ["x,}", "y"] },
    ]);
    expect(filtersIn(plainBraces)('label:"a b",{x,y}')).toEqual([
      { key: "label", negated: false, values: ["a b", "x", "y"] },
    ]);
    // Unclosed, the group does not close and the quote is a value of its own.
    expect(filtersIn(plainBraces)('label:{a,"b c')).toEqual([
      { key: "label", negated: false, values: ["{a", "b c"] },
    ]);
  });

  it("matches long brace runs in linear time", () => {
    const begin = performance.now();
    filtersIn(plainBraces)(`label:${"{".repeat(20000)}`);
    filtersIn(plainBraces)(`label:${"{,".repeat(20000)}`);
    filtersIn(shellBraces)(`label:${"{".repeat(20000)}${"}".repeat(20000)}`);
    expect(performance.now() - begin).toBeLessThan(1000);
  });

  it("leaves braces in free text alone in both modes", () => {
    expect(termsIn(plainBraces)("{a,b} fn(){x}")).toEqual(["{a,b}", "fn(){x}"]);
    expect(termsIn(shellBraces)("{a,b} fn(){x}")).toEqual(["{a,b}", "fn(){x}"]);
  });

  it("does not throw on deeply nested groups", () => {
    const value = `${"{a,".repeat(3000)}b${"}".repeat(3000)}`;
    for (const schema of [plainBraces, shellBraces]) {
      const part = filterPart(schema, `label:${value}`);
      expect(part.values[0]?.error).toMatch(/more than 64/);
    }
  });

  it("fails an expansion over the limit with a reason, keeping the value", () => {
    const value = "{a,b}".repeat(7);
    for (const schema of [plainBraces, shellBraces]) {
      const part = filterPart(schema, `label:${value}`);
      expect(part.values[0]?.error).toMatch(/more than 64/);
      expect(part.values[0]?.expanded).toEqual([value]);
    }
    const ok = filterPart(plainBraces, `label:${"{a,b}".repeat(6)}`);
    expect(ok.values[0]?.error).toBeUndefined();
    expect(ok.values[0]?.expanded).toHaveLength(64);
  });

  it("drops empty alternatives when flattening", () => {
    expect(filtersIn(plainBraces)("label:{,a}")).toEqual([
      { key: "label", negated: false, values: ["a"] },
    ]);
  });

  it("quotes braces in plain mode only when braces are on", () => {
    expect(quoteQueryValue(plainBraces, "{draft}")).toBe('"{draft}"');
    expect(quoteQueryValue(shellBraces, "{draft}")).toBe("'{draft}'");
  });
});

describe("tiling", () => {
  const corpus = [
    "",
    "   ",
    "  a\tb\nc ",
    'a "b c" d',
    'ab"cd"',
    'ab"cd ef"g',
    "harness:codex is:comment 部署",
    '-label:"kind:bug",area:web 慢',
    "status:",
    'label:a"b',
    "--label:a https://app.example",
    "label:'a,b' x\\ y",
    "C:\\temp don\\'t",
    'status:"In Prog',
    "a 'unclosed",
    "label:area:{web,ui},kind:bug {a,b}",
    "label:{'a,b',c} -meta:x=\\{y\\}",
    "trailing\\",
    "😀 label:😀,x",
  ];
  const schemas: [string, CompiledQuerySchema][] = [
    ["plain", defineQuerySchema(todouQualifiers)],
    ["plain + braces", plainBraces],
    ["shell", shell],
    ["shell + braces", shellBraces],
  ];

  it.each(schemas)("tiles every input in %s mode", (_, schema) => {
    for (const q of corpus) {
      const parts: QueryPart[] = parseQuery(schema, q);
      let at = 0;
      for (const part of parts) {
        expect(part.start).toBe(at);
        expect(part.end).toBeGreaterThan(part.start);
        if (part.kind !== "space") {
          expect(q.slice(part.start, part.end)).toBe(part.raw);
        } else {
          expect(q.slice(part.start, part.end).trim()).toBe("");
        }
        if (part.kind === "filter") {
          for (const value of part.values) {
            expect(q.slice(value.start, value.end)).toBe(value.raw);
            expect(value.start).toBeGreaterThan(part.keyEnd);
            expect(value.end).toBeLessThanOrEqual(part.end);
          }
        }
        at = part.end;
      }
      expect(at).toBe(q.length);
    }
  });
});
