import { describe, expect, it } from "vitest";
import { type JsonDialect, parseJson } from "../src/parse.ts";
import type { JsonDocument, NodeFacts } from "../src/types.ts";

function ok(text: string, dialect: JsonDialect = "json"): JsonDocument {
  const result = parseJson(text, { dialect });
  if (!result.ok) {
    throw new Error(
      `${result.error.message} at ${result.error.line}:${result.error.column}`,
    );
  }
  return result.document;
}

function fails(text: string, dialect: JsonDialect) {
  const result = parseJson(text, { dialect });
  if (result.ok) throw new Error(`parsed: ${text}`);
  return result.error;
}

function facts(
  doc: JsonDocument,
  container: object | null,
  key: string | number,
) {
  return doc.facts?.(container, key) as NodeFacts;
}

const texts = (list: { text: string }[] | undefined) =>
  list?.map((c) => c.text);

describe("parseJson", () => {
  it("parses what JSON.parse parses, the same way", () => {
    const text =
      '{"a":[1,2.5,-3e2,true,false,null],"b":{"c":"d\\n\\u00e9\\ud83d\\ude00"},"e":""}';
    expect(ok(text).value).toEqual(JSON.parse(text));
    for (const scalar of ["0", "-0.5", "1E+3", '"x"', "true", "null"]) {
      expect(ok(scalar).value).toEqual(JSON.parse(scalar));
    }
  });

  it("parses the JSON5 spec's example", () => {
    const text = `// This file is written in JSON5 syntax, naturally, but npm needs a regular
// JSON file, so compile via \`npm run build\`. Be sure to keep both in sync!

{
  // comments
  unquoted: 'and you can quote me on that',
  singleQuotes: 'I can use "double quotes" here',
  lineBreaks: "Look, Mom! \\
No \\\\n's!",
  hexadecimal: 0xdecaf,
  leadingDecimalPoint: .8675309, andTrailing: 8675309.,
  positiveSign: +1,
  trailingComma: 'in objects', andIn: ['arrays',],
  "backwardsCompatible": "with JSON",
}`;
    expect(ok(text, "json5").value).toEqual({
      unquoted: "and you can quote me on that",
      singleQuotes: 'I can use "double quotes" here',
      lineBreaks: "Look, Mom! No \\n's!",
      hexadecimal: 0xdecaf,
      leadingDecimalPoint: 0.8675309,
      andTrailing: 8675309,
      positiveSign: 1,
      trailingComma: "in objects",
      andIn: ["arrays"],
      backwardsCompatible: "with JSON",
    });
  });

  it("reads JSON5's numbers, escapes and whitespace", () => {
    expect(
      ok("[Infinity, -Infinity, NaN, +.5, -0x1F, 1e3]", "json5").value,
    ).toEqual([
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      0.5,
      -31,
      1000,
    ]);
    expect(ok("'\\x41\\v\\0\\q\\''", "json5").value).toBe("A\v\0q'");
    expect(ok(" ﻿{ a :\f1}\v", "json5").value).toEqual({
      a: 1,
    });
    expect(ok("{$_a\\u0062é: 1}", "json5").value).toEqual({
      $_abé: 1,
    });
  });

  it("reads JSONC: comments and trailing commas", () => {
    expect(ok('{"a": [1, 2,], /* x */ "b": 1, // y\n}', "jsonc").value).toEqual(
      { a: [1, 2], b: 1 },
    );
  });

  it("skips a byte order mark", () => {
    expect(ok("﻿[1]").value).toEqual([1]);
  });

  it.each([
    ["json", "[1, // no\n2]", "Comments are not allowed in JSON", 1, 5],
    ["json", '{"a": 1,\n}', "Trailing commas are not allowed in JSON", 1, 8],
    ["json", "[1,\n  2,]", "Trailing commas are not allowed in JSON", 2, 4],
    [
      "jsonc",
      "{a: 1}",
      "Unquoted property names are not allowed in JSONC",
      1,
      2,
    ],
    ["jsonc", "['a']", "Single-quoted strings are not allowed in JSONC", 1, 2],
    ["jsonc", "[0x1F]", "Hexadecimal numbers are not allowed in JSONC", 1, 2],
    [
      "jsonc",
      "[\n  Infinity]",
      "Infinity and NaN are not allowed in JSONC",
      2,
      3,
    ],
    ["jsonc", "[+1]", "Leading plus signs are not allowed in JSONC", 1, 2],
    ["jsonc", "[.5]", "Leading decimal points are not allowed in JSONC", 1, 2],
    ["json5", "[1,,]", 'Unexpected character ","', 1, 4],
    ["json5", "[01]", "Leading zeros are not allowed", 1, 2],
    ["json5", "'a\nb'", "Line breaks in strings must be escaped", 1, 3],
    ["json5", "[\\1]", 'Unexpected character "\\\\"', 1, 2],
    ["json", '"a\tb"', "Bad control character in string", 1, 3],
    ["json", '"\\v"', "Bad escape in string", 1, 2],
    ["json", '{"a" 1}', 'Expected ":" after a property name', 1, 6],
    [
      "json",
      '{"a": 1 "b"}',
      'Expected "," or "}" after a property value',
      1,
      9,
    ],
    ["json", "[1 2]", 'Expected "," or "]" after an array item', 1, 4],
    ["json", "[1] 2", "Unexpected content after the value", 1, 5],
    ["json", '{"a": [1,', "Unexpected end of input", 1, 10],
    ["json", '"abc', "Unterminated string", 1, 1],
    ["jsonc", "/* open", "Unterminated comment", 1, 1],
    ["json", "", "Unexpected end of input", 1, 1],
    ["json", "\r\n\r\n  x", 'Unexpected character "x"', 3, 3],
  ] as const)(
    "%s rejects %j: %s at %i:%i",
    (dialect, text, message, line, column) => {
      const error = fails(text, dialect);
      expect(error.message).toBe(message);
      expect([error.line, error.column]).toEqual([line, column]);
    },
  );

  describe("comments", () => {
    const text = `// before the root
{
  // leading a
  /* and a block,
     over two lines */
  "a": 1, // trailing a, after the comma
  "b": 2 /* trailing b */ ,
  "c": /* between */ 3,
  "d": [ // on d's line
    true // last, no comma
    // dangling in d
  ],
  "e": {}
  // dangling in the root
}
// after the root`;
    const doc = ok(text, "jsonc");
    const root = doc.value as Record<string, unknown>;

    it("puts a comment before a member in its leading", () => {
      expect(texts(facts(doc, root, "a").leading)).toEqual([
        "// leading a",
        "/* and a block,\n     over two lines */",
      ]);
      expect(facts(doc, root, "a").leading?.[1]?.block).toBe(true);
    });

    it("puts a comment after a value on its line in its trailing", () => {
      expect(facts(doc, root, "a").trailing?.text).toBe(
        "// trailing a, after the comma",
      );
      expect(facts(doc, root, "b").trailing?.text).toBe("/* trailing b */");
      const d = root.d as unknown[];
      expect(facts(doc, d, 0).trailing?.text).toBe("// last, no comma");
    });

    it("puts a comment between a key and its value in its trailing", () => {
      expect(facts(doc, root, "c").trailing?.text).toBe("/* between */");
    });

    it("puts a comment after an opening bracket on its line on the container's row", () => {
      expect(facts(doc, root, "d").trailing?.text).toBe("// on d's line");
    });

    it("puts a comment before a closing bracket in the container's dangling", () => {
      expect(texts(facts(doc, root, "d").dangling)).toEqual([
        "// dangling in d",
      ]);
    });

    it("puts comments around the root in its leading and dangling", () => {
      const rootFacts = facts(doc, null, "$");
      expect(texts(rootFacts.leading)).toEqual(["// before the root"]);
      expect(texts(rootFacts.dangling)).toEqual([
        "// dangling in the root",
        "// after the root",
      ]);
    });

    it("keeps each comment's range on its text", () => {
      const comment = facts(doc, root, "b").trailing;
      expect(comment && text.slice(...comment.range)).toBe(comment?.text);
    });
  });

  it("gives ranges and member ranges that slice back to the source", () => {
    const text = '{ "a" : [ 1 , { "b": "x" } ] , "c":null }';
    const doc = ok(text);
    const root = doc.value as Record<string, unknown>;
    const a = root.a as unknown[];
    expect(text.slice(...facts(doc, null, "$").range)).toBe(text);
    expect(text.slice(...facts(doc, root, "a").range)).toBe(
      '[ 1 , { "b": "x" } ]',
    );
    expect(text.slice(...(facts(doc, root, "a").memberRange ?? [0, 0]))).toBe(
      '"a" : [ 1 , { "b": "x" } ]',
    );
    expect(text.slice(...facts(doc, a, 1).range)).toBe('{ "b": "x" }');
    expect(text.slice(...(facts(doc, a, 1).memberRange ?? [0, 0]))).toBe(
      '{ "b": "x" }',
    );
    expect(text.slice(...facts(doc, a[1] as object, "b").range)).toBe('"x"');
    expect(text.slice(...facts(doc, root, "c").range)).toBe("null");
  });

  it("keeps numbers and strings as written where they differ", () => {
    const doc = ok(
      "[0x1F, 1e3, 1.0, 12345678901234567890, Infinity, -0, 7, 'q', \"d\", 'a\\\nb']",
      "json5",
    );
    const list = doc.value as unknown[];
    const literals = list.map((_, i) => facts(doc, list, i).literal);
    expect(literals).toEqual([
      "0x1F",
      "1e3",
      "1.0",
      "12345678901234567890",
      undefined,
      "-0",
      undefined,
      "'q'",
      undefined,
      "'a\\\nb'",
    ]);
    expect(list[3]).toBe(Number("12345678901234567890"));
  });

  it("lets a duplicate key's last value win, with its facts", () => {
    const doc = ok('{"a": 1, // first\n"b": 0, "a": 2}', "jsonc");
    const root = doc.value as Record<string, unknown>;
    expect(root).toEqual(JSON.parse('{"a": 1, "b": 0, "a": 2}'));
    expect(Object.keys(root)).toEqual(["a", "b"]);
    expect(facts(doc, root, "a").trailing).toBeUndefined();
  });

  it("keeps __proto__ an own key", () => {
    const value = ok('{"__proto__": {"x": 1}}').value as Record<
      string,
      unknown
    >;
    expect(Object.keys(value)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect((value as { x?: number }).x).toBeUndefined();
  });

  it("parses 10000 levels of nesting without a stack overflow", () => {
    const depth = 10000;
    const text = `${"[".repeat(depth)}1${"]".repeat(depth)}`;
    let node = ok(text).value;
    for (let i = 0; i < depth; i++) node = (node as unknown[])[0];
    expect(node).toBe(1);
    const objects = `${'{"a":'.repeat(depth)}1${"}".repeat(depth)}`;
    expect(parseJson(objects).ok).toBe(true);
  });

  it("decodes escapes, surrogate pairs included", () => {
    expect(ok('"\\ud83d\\ude00 \\u00e9 \\/ \\b\\f"').value).toBe("😀 é / \b\f");
    expect(ok('"😀"').value).toBe("😀");
  });
});
