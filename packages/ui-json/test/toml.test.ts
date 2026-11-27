import { describe, expect, it } from "vitest";
import { selectionSource } from "../src/selection.ts";
import { readToml } from "../src/toml-reader.ts";
import type { JsonDocument, NodeFacts } from "../src/types.ts";

function parsed(text: string): JsonDocument {
  const result = readToml(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
}

/** The facts at a path of keys, walked from the root. */
function factsAt(document: JsonDocument, ...path: (string | number)[]) {
  let container: unknown = null;
  let value: unknown = document.value;
  let facts = document.facts?.(null, "$");
  for (const key of path) {
    container = value;
    value = (value as Record<string | number, unknown>)[key];
    facts = document.facts?.(container as object, key);
  }
  return facts as NodeFacts;
}

const slice = (document: JsonDocument, range: [number, number] | undefined) =>
  range ? document.source?.slice(...range) : undefined;

const texts = (comments: { text: string }[] | undefined) =>
  comments?.map((c) => c.text);

const MOCKUP = `# Settings for the sample service

title = "sample"
mode = 0x1F
timeout = 1_500  # ms

[server]
host = "0.0.0.0"
port = 8080
started = 2026-11-21T09:30:00Z

# off in development
[server.tls]
enabled = false

[[upstream]]
name = "api"
weight = 0.75
window = { opens = 09:00, closes = 17:30 }

[[upstream]]
name = "static"
weight = 0.25
`;

describe("readToml", () => {
  it("builds the tree the mockup's file builds", () => {
    const document = parsed(MOCKUP);
    expect(document.value).toEqual({
      title: "sample",
      mode: 31,
      timeout: 1500,
      server: {
        host: "0.0.0.0",
        port: 8080,
        started: "2026-11-21T09:30:00Z",
        tls: { enabled: false },
      },
      upstream: [
        {
          name: "api",
          weight: 0.75,
          window: { opens: "09:00", closes: "17:30" },
        },
        { name: "static", weight: 0.25 },
      ],
    });
  });

  it("places the mockup's comments", () => {
    const document = parsed(MOCKUP);
    expect(texts(factsAt(document).leading)).toEqual([
      "# Settings for the sample service",
    ]);
    expect(factsAt(document, "title").leading).toBeUndefined();
    expect(factsAt(document, "timeout").trailing?.text).toBe("# ms");
    expect(texts(factsAt(document, "server", "tls").leading)).toEqual([
      "# off in development",
    ]);
    expect(factsAt(document, "server").dangling).toBeUndefined();
  });

  it("keeps a number's text where JSON would write it otherwise", () => {
    const document = parsed(
      "a = 0x1F\nb = 0o17\nc = 0b101\nd = 1_500\ne = +5\nf = 1.0\ng = 1e3\nh = inf\ni = -inf\nj = nan\nk = 42\nl = 0.5\nm = true\nn = 'lit'\n",
    );
    const literal = (key: string) => factsAt(document, key).literal;
    expect(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(literal),
    ).toEqual([
      "0x1F",
      "0o17",
      "0b101",
      "1_500",
      "+5",
      "1.0",
      "1e3",
      "inf",
      "-inf",
      "nan",
    ]);
    expect(["k", "l", "m", "n"].map(literal)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    const value = document.value as Record<string, unknown>;
    expect(value.h).toBe(Number.POSITIVE_INFINITY);
    expect(value.j).toBeNaN();
    expect(value.n).toBe("lit");
  });

  it("keeps a 64-bit integer's digits", () => {
    const document = parsed("big = 9007199254740993\n");
    expect((document.value as { big: number }).big).toBe(9007199254740992);
    expect(factsAt(document, "big").literal).toBe("9007199254740993");
  });

  it("reads each kind of date and time as its text", () => {
    const document = parsed(
      "odt = 2026-11-21T09:30:00Z\nldt = 2026-11-21 09:30\nld = 2026-12-01\nlt = 09:00\n",
    );
    expect(document.value).toEqual({
      odt: "2026-11-21T09:30:00Z",
      ldt: "2026-11-21 09:30",
      ld: "2026-12-01",
      lt: "09:00",
    });
    for (const key of ["odt", "ldt", "ld", "lt"]) {
      const facts = factsAt(document, key);
      expect(facts.literal).toBe(slice(document, facts.range));
    }
  });

  it("reads TOML 1.1: a multi-line inline table, its trailing comma and comments, new escapes", () => {
    const document = parsed(
      't = {\n  a = 1, # one\n  # lead b\n  b = 2,\n}\ns = "\\e\\x41"\n',
    );
    expect(document.value).toEqual({ t: { a: 1, b: 2 }, s: "\u001bA" });
    expect(factsAt(document, "t", "a").trailing?.text).toBe("# one");
    expect(texts(factsAt(document, "t", "b").leading)).toEqual(["# lead b"]);
  });

  it("walks dotted keys and quoted keys, and keeps __proto__ an own key", () => {
    const document = parsed(
      'a.b.c = 1\na.d = 2\n"odd key".x = 3\n[t."q k"]\n__proto__ = 4\n',
    );
    const value = document.value as Record<string, unknown>;
    expect(value.a).toEqual({ b: { c: 1 }, d: 2 });
    expect(value["odd key"]).toEqual({ x: 3 });
    const inner = (value.t as Record<string, Record<string, unknown>>)[
      "q k"
    ] as object;
    expect(Object.getOwnPropertyDescriptor(inner, "__proto__")?.value).toBe(4);
    expect(Object.getPrototypeOf(inner)).toBe(Object.prototype);
  });

  it("does not take a key from Object.prototype for a table", () => {
    const document = parsed("[constructor]\nx = 1\n[toString.y]\nz = 2\n");
    expect(document.value).toEqual({
      constructor: { x: 1 },
      toString: { y: { z: 2 } },
    });
  });

  describe("ranges", () => {
    const text = `a = 1
d.e = 2
d.f = 3

[s]
k = "v"
i = { x = 1, y = [1, 2] }

[[arr]]
n = 1
[arr.sub]
m = 2
[[arr]]
n = 3
`;
    const document = parsed(text);

    it("runs a key–value's member from its key and its value as written", () => {
      const facts = factsAt(document, "a");
      expect(slice(document, facts.range)).toBe("1");
      expect(slice(document, facts.memberRange)).toBe("a = 1");
      expect(slice(document, factsAt(document, "d", "e").memberRange)).toBe(
        "d.e = 2",
      );
    });

    it("runs a header's table from its header to its last key–value", () => {
      const facts = factsAt(document, "s");
      expect(slice(document, facts.range)).toBe(
        '[s]\nk = "v"\ni = { x = 1, y = [1, 2] }',
      );
      expect(facts.memberRange).toEqual(facts.range);
    });

    it("gives inline tables and arrays JSON's ranges", () => {
      expect(slice(document, factsAt(document, "s", "i").range)).toBe(
        "{ x = 1, y = [1, 2] }",
      );
      expect(
        slice(document, factsAt(document, "s", "i", "y").memberRange),
      ).toBe("y = [1, 2]");
      expect(slice(document, factsAt(document, "s", "i", "y", 1).range)).toBe(
        "2",
      );
    });

    it("runs an array of tables' item over its sections, and the array over its items", () => {
      expect(slice(document, factsAt(document, "arr", 0).range)).toBe(
        "[[arr]]\nn = 1\n[arr.sub]\nm = 2",
      );
      expect(slice(document, factsAt(document, "arr").range)).toBe(
        "[[arr]]\nn = 1\n[arr.sub]\nm = 2\n[[arr]]\nn = 3",
      );
      expect(factsAt(document, "arr").parts).toBeUndefined();
    });

    it("runs dotted keys' table over them, merged into one place", () => {
      const facts = factsAt(document, "d");
      expect(slice(document, facts.range)).toBe("d.e = 2\nd.f = 3");
      expect(facts.parts).toBeUndefined();
    });

    it("covers the whole text at the root, less a byte-order mark", () => {
      expect(factsAt(document).range).toEqual([0, text.length]);
      const bom = parsed("﻿a = 1\n");
      expect(factsAt(bom).range).toEqual([1, 7]);
      expect(slice(bom, factsAt(bom, "a").range)).toBe("1");
    });
  });

  describe("parts", () => {
    it("gives a table written in two places with another between them its parts", () => {
      const text = MOCKUP.replace(
        "# off in development\n",
        '[logging]\nlevel = "info"\n\n# off in development\n',
      );
      const document = parsed(text);
      const facts = factsAt(document, "server");
      expect(facts.parts?.map((part) => slice(document, part))).toEqual([
        '[server]\nhost = "0.0.0.0"\nport = 8080\nstarted = 2026-11-21T09:30:00Z',
        "[server.tls]\nenabled = false",
      ]);
      expect(facts.range).toEqual([
        facts.parts?.[0]?.[0],
        facts.parts?.[1]?.[1],
      ]);
      expect(factsAt(document, "server", "tls").parts).toBeUndefined();
    });

    it("gives a table written only through two headers with one between them both", () => {
      const document = parsed("[a.x]\nn = 1\n[b]\n[a.y]\nn = 2\n");
      expect(
        factsAt(document, "a").parts?.map((part) => slice(document, part)),
      ).toEqual(["[a.x]\nn = 1", "[a.y]\nn = 2"]);
    });

    it("splits dotted keys with another key between them", () => {
      const document = parsed("a.b = 1\nz = 0\na.c = 2\n");
      expect(
        factsAt(document, "a").parts?.map((part) => slice(document, part)),
      ).toEqual(["a.b = 1", "a.c = 2"]);
    });

    it("splits an array of tables' item by the sections after it", () => {
      const document = parsed(
        "[[up]]\nn = 1\n[other]\n[up.x]\nm = 2\n[[up]]\nn = 2\n",
      );
      expect(
        factsAt(document, "up", 0).parts?.map((part) => slice(document, part)),
      ).toEqual(["[[up]]\nn = 1", "[up.x]\nm = 2"]);
      expect(
        factsAt(document, "up").parts?.map((part) => slice(document, part)),
      ).toEqual(["[[up]]\nn = 1", "[up.x]\nm = 2\n[[up]]\nn = 2"]);
    });

    it("merges places with only comments between them", () => {
      const document = parsed("[a]\nn = 1\n\n# next\n[a.b]\nm = 2\n");
      expect(factsAt(document, "a").parts).toBeUndefined();
    });
  });

  describe("comments", () => {
    it("trails a key–value on its line, and a header's table on the header's", () => {
      const document = parsed(
        "a = 1 # one\n[t] # the table\nb = 2\n[[arr]] # an item\n",
      );
      expect(factsAt(document, "a").trailing?.text).toBe("# one");
      expect(factsAt(document, "t").trailing?.text).toBe("# the table");
      expect(factsAt(document, "arr", 0).trailing?.text).toBe("# an item");
      expect(factsAt(document, "arr").trailing).toBeUndefined();
    });

    it("leads the next key–value with the lines before it", () => {
      const document = parsed("a = 1\n# about b\n\n# more\nb = 2\n");
      expect(texts(factsAt(document, "b").leading)).toEqual([
        "# about b",
        "# more",
      ]);
    });

    it("leads a dotted key's first new table", () => {
      const document = parsed("x = 0\n# about a\na.b = 1\n");
      expect(texts(factsAt(document, "a").leading)).toEqual(["# about a"]);
    });

    it("leads a header, and leaves a block apart from it as the section's dangling", () => {
      const document = parsed(
        "[a]\nn = 1\n# end of a\n\n# before b\n[b]\nm = 2\n",
      );
      expect(texts(factsAt(document, "a").dangling)).toEqual(["# end of a"]);
      expect(texts(factsAt(document, "b").leading)).toEqual(["# before b"]);
    });

    it("leads the first header with the top level's comments, blank line or not", () => {
      const document = parsed("x = 1\n# apart\n\n# before t\n[t]\n");
      expect(texts(factsAt(document, "t").leading)).toEqual([
        "# apart",
        "# before t",
      ]);
      expect(factsAt(document).dangling).toBeUndefined();
    });

    it("leads the root at the file's start when a blank line separates them", () => {
      const apart = parsed("# file\n\n# about a\na = 1\n");
      expect(texts(factsAt(apart).leading)).toEqual(["# file"]);
      expect(texts(factsAt(apart, "a").leading)).toEqual(["# about a"]);
      const close = parsed("# about a\na = 1\n");
      expect(factsAt(close).leading).toBeUndefined();
      expect(texts(factsAt(close, "a").leading)).toEqual(["# about a"]);
    });

    it("leaves the comments at the end to the last section, or the root", () => {
      const sections = parsed("[a]\nn = 1\n# done\n");
      expect(texts(factsAt(sections, "a").dangling)).toEqual(["# done"]);
      expect(factsAt(sections).dangling).toBeUndefined();
      const flat = parsed("n = 1\n\n# done\n");
      expect(texts(factsAt(flat).dangling)).toEqual(["# done"]);
      const only = parsed("# nothing yet\n");
      expect(texts(factsAt(only).leading)).toEqual(["# nothing yet"]);
    });

    it("places comments in an array as JSONC places them", () => {
      const document = parsed(
        "x = [ # the list\n  1, # one\n  # lead two\n  2,\n  # left over\n] # after\ny = 2\n",
      );
      const x = factsAt(document, "x");
      expect(x.trailing?.text).toBe("# the list");
      expect(factsAt(document, "x", 0).trailing?.text).toBe("# one");
      expect(texts(factsAt(document, "x", 1).leading)).toEqual(["# lead two"]);
      expect(texts(x.dangling)).toEqual(["# left over"]);
      expect(texts(factsAt(document, "y").leading)).toEqual(["# after"]);
    });

    it("writes each comment as written, # and all, never as a block", () => {
      const document = parsed("a = 1 #  spaced\n");
      expect(factsAt(document, "a").trailing).toEqual({
        text: "#  spaced",
        block: false,
        range: [6, 15],
      });
    });
  });

  describe("errors", () => {
    it("fails a key defined twice", () => {
      expect(readToml("a = 1\na = 2\n")).toEqual({
        ok: false,
        error: {
          message: "Defining a key multiple times is invalid",
          offset: 6,
          line: 2,
          column: 1,
        },
      });
    });

    it("fails a table defined twice", () => {
      const result = readToml("[a]\nx = 1\n[a]\n");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toBe(
        "Defining a key multiple times is invalid",
      );
      expect(result.error.line).toBe(3);
    });

    it("fails an unterminated inline table at its end", () => {
      expect(readToml("x = { a = 1")).toEqual({
        ok: false,
        error: {
          message: "Unterminated inline table",
          offset: 11,
          line: 1,
          column: 12,
        },
      });
    });
  });
});

describe("Copy source over TOML", () => {
  it("copies an array of tables' item with its header", () => {
    const document = parsed(MOCKUP);
    expect(
      selectionSource(document, { type: "value", path: "$.upstream[0]" }),
    ).toBe(
      '[[upstream]]\nname = "api"\nweight = 0.75\nwindow = { opens = 09:00, closes = 17:30 }',
    );
  });

  it("copies a key–value member as key = value, and a value as its text", () => {
    const document = parsed(MOCKUP);
    const members = {
      type: "members",
      anchor: "$.server.port",
      focus: "$.server.port",
    } as const;
    expect(selectionSource(document, members)).toBe("port = 8080");
    expect(
      selectionSource(document, { type: "value", path: "$.server.started" }),
    ).toBe("2026-11-21T09:30:00Z");
  });

  it("copies a table written in two places as each place, and nothing between", () => {
    const document = parsed(
      '[server]\nhost = "0.0.0.0"\nport = 8080\n\n[logging]\nlevel = "info"\n\n[server.tls]\nenabled = false\n',
    );
    expect(selectionSource(document, { type: "value", path: "$.server" })).toBe(
      '[server]\nhost = "0.0.0.0"\nport = 8080\n\n[server.tls]\nenabled = false',
    );
  });
});
