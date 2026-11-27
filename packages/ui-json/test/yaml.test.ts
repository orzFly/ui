import { describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import type { JsonDocument, NodeFacts } from "../src/types.ts";
import type { ParseYamlOptions } from "../src/yaml.ts";
import { readYaml } from "../src/yaml-reader.ts";

function ok(text: string, options?: ParseYamlOptions): JsonDocument {
  const result = readYaml(text, options);
  if (!result.ok) {
    throw new Error(
      `${result.error.message} at ${result.error.line}:${result.error.column}`,
    );
  }
  return result.document;
}

function fails(text: string, options?: ParseYamlOptions) {
  const result = readYaml(text, options);
  if (result.ok) throw new Error(`parsed: ${text}`);
  return result.error;
}

/** The facts at a path of plain keys and indexes, from the root. */
function at(doc: JsonDocument, ...path: (string | number)[]): NodeFacts {
  let container: object | null = null;
  let key: string | number = "$";
  let value = doc.value;
  for (const segment of path) {
    container = value as object;
    key = segment;
    value = (value as Record<string | number, unknown>)[segment];
  }
  return doc.facts?.(container, key) as NodeFacts;
}

const slice = (doc: JsonDocument, range: [number, number] | undefined) =>
  range ? doc.source?.slice(...range) : undefined;

const texts = (list: { text: string }[] | undefined) =>
  list?.map((c) => c.text);

const PIPELINE = `# Build pipeline for the sample service
defaults: &defaults
  image: node:22   # pinned for the cache
  retries: 0x3
  env:
    - CI=true
    # more come from the runner

build:
  <<: *defaults
  script: |
    pnpm install
    pnpm build
  checksum: !!binary aGVsbG8=
  cache: ~
deploy:
  <<: *defaults
  when: manual
`;

const STREAM = `# rendered manifests
apiVersion: v1
kind: ConfigMap
metadata: { name: settings }
---
apiVersion: v1
kind: Service
metadata: { name: web }
---
apiVersion: apps/v1
kind: Deployment
`;

describe("readYaml", () => {
  it("reads the pipeline: its values, facts and comments", () => {
    const doc = ok(PIPELINE);
    const value = doc.value as Record<string, Record<string, unknown>>;
    const defaults = {
      image: "node:22",
      retries: 3,
      env: ["CI=true"],
    };
    expect(value).toEqual({
      defaults,
      build: {
        "<<": defaults,
        script: "pnpm install\npnpm build\n",
        checksum: "aGVsbG8=",
        cache: null,
      },
      deploy: { "<<": defaults, when: "manual" },
    });

    expect(texts(at(doc).leading)).toEqual([
      "# Build pipeline for the sample service",
    ]);
    expect(at(doc).dangling).toBeUndefined();

    const anchored = at(doc, "defaults");
    expect(anchored.anchor).toBe("defaults");
    expect(slice(doc, anchored.range)).toMatch(/^&defaults\n {2}image/);
    expect(slice(doc, anchored.range)).toMatch(/- CI=true$/);
    expect(slice(doc, anchored.memberRange)).toMatch(/^defaults: &defaults/);

    const image = at(doc, "defaults", "image");
    expect(slice(doc, image.range)).toBe("node:22");
    expect(slice(doc, image.memberRange)).toBe("image: node:22");
    expect(image.trailing?.text).toBe("# pinned for the cache");
    expect(image.trailing?.block).toBe(false);

    expect(at(doc, "defaults", "retries").literal).toBe("0x3");
    expect(texts(at(doc, "defaults", "env").dangling)).toEqual([
      "# more come from the runner",
    ]);
    expect(slice(doc, at(doc, "defaults", "env", 0).memberRange)).toBe(
      "- CI=true",
    );

    const merge = at(doc, "build", "<<");
    expect(merge.alias).toEqual({
      name: "defaults",
      path: "$.defaults",
      recursive: false,
    });
    expect(slice(doc, merge.range)).toBe("*defaults");
    expect(slice(doc, merge.memberRange)).toBe("<<: *defaults");

    const script = at(doc, "build", "script");
    expect(slice(doc, script.range)).toBe(
      "|\n    pnpm install\n    pnpm build",
    );
    expect(script.literal).toBeUndefined();

    const checksum = at(doc, "build", "checksum");
    expect(checksum.tag).toBe("!!binary");
    expect(slice(doc, checksum.range)).toBe("!!binary aGVsbG8=");
    expect(at(doc, "build", "cache").literal).toBe("~");
    expect(slice(doc, at(doc, "build").range)).toMatch(/cache: ~$/);
  });

  it("shares an alias's value with its anchor, and the anchor's facts below it", () => {
    const doc = ok(PIPELINE);
    const value = doc.value as Record<string, Record<string, unknown>>;
    expect(value.build?.["<<"]).toBe(value.defaults);
    expect(value.deploy?.["<<"]).toBe(value.defaults);
    expect(at(doc, "build", "<<", "image")).toBe(at(doc, "defaults", "image"));
  });

  describe("values", () => {
    it("reads every core-schema scalar", () => {
      const doc = ok(
        "s: text\nq: 'single'\nd: \"double\\n\"\ni: 42\nn: -7\no: 0o17\nh: 0x1F\nf: 1.5\ne: 1e3\ninf: -.Inf\nnan: .nan\nt: true\nT: TRUE\nf2: false\nnul: null\nt2: ~\nN: Null\nyes: yes\n",
      );
      expect(doc.value).toEqual({
        s: "text",
        q: "single",
        d: "double\n",
        i: 42,
        n: -7,
        o: 15,
        h: 31,
        f: 1.5,
        e: 1000,
        inf: Number.NEGATIVE_INFINITY,
        nan: Number.NaN,
        t: true,
        T: true,
        f2: false,
        nul: null,
        t2: null,
        N: null,
        yes: "yes",
      });
    });

    it("keeps a literal written otherwise than String(value), and only then", () => {
      const doc = ok(
        "a: 0x3\nb: 0o17\nc: .inf\nd: -.Inf\ne: .nan\nf: ~\ng: Null\nh: TRUE\ni: 1e3\nj: 3\nk: true\nl: null\nm: 'quoted'\nn: -1.5\n",
      );
      const literal = (key: string) => at(doc, key).literal;
      expect(literal("a")).toBe("0x3");
      expect(literal("b")).toBe("0o17");
      expect(literal("c")).toBe(".inf");
      expect(literal("d")).toBe("-.Inf");
      expect(literal("e")).toBe(".nan");
      expect(literal("f")).toBe("~");
      expect(literal("g")).toBe("Null");
      expect(literal("h")).toBe("TRUE");
      expect(literal("i")).toBe("1e3");
      for (const key of ["j", "k", "l", "m", "n"]) {
        expect(literal(key)).toBeUndefined();
      }
    });

    it("reads block and flow collections alike", () => {
      const doc = ok(
        "block:\n  - 1\n  - two\n  - k: v\nflow: [1, two, {k: v}]\nmap: {a: 1, b: [x]}\n",
      );
      expect(doc.value).toEqual({
        block: [1, "two", { k: "v" }],
        flow: [1, "two", { k: "v" }],
        map: { a: 1, b: ["x"] },
      });
      expect(slice(doc, at(doc, "flow", 2).range)).toBe("{k: v}");
      expect(slice(doc, at(doc, "flow", 2, "k").memberRange)).toBe("k: v");
      expect(slice(doc, at(doc, "block", 2).memberRange)).toBe("- k: v");
    });

    it("turns a key that is not a string into its source text", () => {
      const doc = ok("1: a\ntrue: b\n~: c\n? [a,\n   b]\n: d\n0x1: e\n");
      expect(Object.keys(doc.value as object)).toEqual([
        "1",
        "true",
        "~",
        "[a, b]",
        "0x1",
      ]);
      expect(slice(doc, at(doc, "[a, b]").memberRange)).toBe(
        "? [a,\n   b]\n: d",
      );
    });

    it("lets the last duplicate key win, with its facts", () => {
      const doc = ok("a: 1\nb: 2\na: 3 # last\n");
      expect(doc.value).toEqual({ a: 3, b: 2 });
      expect(Object.keys(doc.value as object)).toEqual(["a", "b"]);
      expect(slice(doc, at(doc, "a").memberRange)).toBe("a: 3");
      expect(at(doc, "a").trailing?.text).toBe("# last");
    });

    it("keeps __proto__ as an own key", () => {
      const doc = ok("__proto__: {polluted: true}\n");
      const value = doc.value as Record<string, unknown>;
      expect(Object.hasOwn(value, "__proto__")).toBe(true);
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("reads an empty value as null, with no literal", () => {
      const doc = ok("cache:\nlist:\n  -\n  - &k\nnext: 1\n");
      expect(doc.value).toEqual({ cache: null, list: [null, null], next: 1 });
      expect(at(doc, "cache").literal).toBeUndefined();
      expect(slice(doc, at(doc, "cache").memberRange)).toBe("cache:");
      expect(slice(doc, at(doc, "list", 1).range)).toBe("&k");
      expect(at(doc, "list", 1).anchor).toBe("k");
    });

    it("keeps a big integer's digits in its literal", () => {
      const doc = ok("big: 12345678901234567890\n");
      expect((doc.value as { big: number }).big).toBe(
        Number("12345678901234567890"),
      );
      expect(at(doc, "big").literal).toBe("12345678901234567890");
    });

    it("reads the core schema whatever %YAML says", () => {
      const doc = ok("%YAML 1.1\n---\nflag: yes\nmode: 0644\n");
      expect(doc.value).toEqual({ flag: "yes", mode: 644 });
    });

    it("reads an empty text as null", () => {
      expect(ok("").value).toBeNull();
      expect(ok("# only a comment\n").value).toBeNull();
    });
  });

  describe("anchors, aliases and tags", () => {
    it("keeps an unknown tag as written, with the untagged value", () => {
      const doc = ok(
        "a: !!binary aGVsbG8=\nb: !thing 3\nc: !!set {x, y}\nd: !!omap [k: 1]\ne: !!str 3\nf: !<tag:example.com,2026:x> v\n",
      );
      expect(doc.value).toEqual({
        a: "aGVsbG8=",
        b: 3,
        c: { x: null, y: null },
        d: [{ k: 1 }],
        e: "3",
        f: "v",
      });
      expect(at(doc, "a").tag).toBe("!!binary");
      expect(at(doc, "b").tag).toBe("!thing");
      expect(at(doc, "c").tag).toBe("!!set");
      expect(at(doc, "d").tag).toBe("!!omap");
      expect(at(doc, "e").tag).toBe("!!str");
      expect(at(doc, "f").tag).toBe("!<tag:example.com,2026:x>");
    });

    it("starts a value's range at its first property", () => {
      const doc = ok("a: !t &x 1\nb: &y !t 2\nc: *x\n");
      expect(slice(doc, at(doc, "a").range)).toBe("!t &x 1");
      expect(slice(doc, at(doc, "b").range)).toBe("&y !t 2");
      expect(at(doc, "a")).toMatchObject({ anchor: "x", tag: "!t" });
      expect(at(doc, "c").alias?.path).toBe("$.a");
      expect(at(doc, "c").anchor).toBeUndefined();
    });

    it("leaves merge keys as written", () => {
      const doc = ok("base: &b {a: 1}\nm:\n  <<: *b\n  c: 2\n");
      expect(doc.value).toEqual({
        base: { a: 1 },
        m: { "<<": { a: 1 }, c: 2 },
      });
    });

    it("gives an alias the path of its anchor, and its anchor's literal", () => {
      const doc = ok("list:\n  - x\n  - &n 0x10\nref: *n\n");
      expect(at(doc, "ref").alias).toEqual({
        name: "n",
        path: "$.list[1]",
        recursive: false,
      });
      expect(at(doc, "ref").literal).toBe("0x10");
      expect((doc.value as { ref: number }).ref).toBe(16);
    });

    it("resolves an alias to the last anchor of its name before it", () => {
      const doc = ok("a: &x 1\nb: *x\nc: &x 2\nd: *x\n");
      expect(doc.value).toEqual({ a: 1, b: 1, c: 2, d: 2 });
      expect(at(doc, "d").alias?.path).toBe("$.c");
    });

    it("marks an alias inside its own anchor as recursive", () => {
      const doc = ok("a: &x [1, *x]\nb: *x\n");
      const value = doc.value as { a: unknown[]; b: unknown[] };
      expect(value.a[1]).toBe(value.a);
      expect(value.b).toBe(value.a);
      expect(at(doc, "a", 1).alias).toEqual({
        name: "x",
        path: "$.a",
        recursive: true,
      });
      expect(at(doc, "b").alias?.recursive).toBe(false);
    });

    it("fails on an alias with no anchor", () => {
      const error = fails("a: *nope\n");
      expect(error.message).toBe(
        "Unresolved alias (the anchor must be set before the alias): nope",
      );
      expect(error).toMatchObject({ offset: 3, line: 1, column: 4 });
    });

    it("guards alias expansion as yaml's toJS does", () => {
      const levels = ["a: &a [lol, lol, lol, lol, lol, lol, lol, lol, lol]"];
      for (let i = 1; i < 9; i++) {
        const prev = String.fromCharCode(96 + i);
        const name = String.fromCharCode(97 + i);
        levels.push(
          `${name}: &${name} [${Array(9).fill(`*${prev}`).join(", ")}]`,
        );
      }
      const bomb = `${levels.join("\n")}\n`;
      const error = fails(bomb);
      expect(error.message).toBe(
        "Excessive alias count indicates a resource exhaustion attack",
      );
      expect(() => yamlParse(bomb)).toThrow(error.message);
      expect(ok(bomb, { maxAliasCount: -1 }).value).toHaveProperty("i");
    });

    it("counts aliases to the same limit as yaml's toJS", () => {
      for (const count of [99, 100, 101]) {
        const text = `a: &a 1\nlist: [${Array(count).fill("*a").join(", ")}]\n`;
        let theirs = true;
        try {
          yamlParse(text);
        } catch {
          theirs = false;
        }
        expect(readYaml(text).ok).toBe(theirs);
      }
    });
  });

  describe("streams", () => {
    it("makes the root a list with an item per document", () => {
      const doc = ok(STREAM);
      const value = doc.value as { kind: string }[];
      expect(value).toHaveLength(3);
      expect(value.map((item) => item.kind)).toEqual([
        "ConfigMap",
        "Service",
        "Deployment",
      ]);
      expect(texts(at(doc, 0).leading)).toEqual(["# rendered manifests"]);
      expect(at(doc).leading).toBeUndefined();
      expect(slice(doc, at(doc, 1).range)).toMatch(/^apiVersion: v1/);
      expect(slice(doc, at(doc, 1).memberRange)).toMatch(/^---\napiVersion/);
      expect(slice(doc, at(doc, 0).memberRange)).toMatch(/^apiVersion/);
    });

    it("starts a document's member at its first directive", () => {
      const doc = ok("a: 1\n...\n%TAG !e! tag:example.com,2026:\n---\nb: 2\n");
      expect(doc.value).toEqual([{ a: 1 }, { b: 2 }]);
      expect(slice(doc, at(doc, 1).memberRange)).toMatch(/^%TAG/);
    });

    it("reads a document with no content as null", () => {
      const doc = ok("---\na: 1\n---\n---\nb: 2\n");
      expect(doc.value).toEqual([{ a: 1 }, null, { b: 2 }]);
    });

    it("places each document's comments", () => {
      const doc = ok(
        "# first\na: 1\n--- # second\nb: 2\n# before the third\n---\nc: 3\n# after all\n",
      );
      expect(texts(at(doc, 0).leading)).toEqual(["# first"]);
      expect(texts(at(doc, 1).leading)).toEqual(["# second"]);
      expect(texts(at(doc, 2).leading)).toEqual(["# before the third"]);
      expect(texts(at(doc).dangling)).toEqual(["# after all"]);
    });

    it("gives alias paths under the document's index", () => {
      const doc = ok("a: 1\n---\nbase: &b {x: 1}\nuse: *b\n");
      expect(at(doc, 1, "use").alias?.path).toBe("$[1].base");
    });

    it("fails on an error in any document, at its place", () => {
      const error = fails("a: 1\n---\nb: 1\n c: 2\n");
      expect(error).toMatchObject({ line: 3, column: 4 });
      expect(error.message).not.toContain("\n");
    });
  });

  describe("comments", () => {
    it("trails the member on whose line a comment follows", () => {
      const doc = ok(
        "a: 1 # one\nb: [2, 3] # flow\nc:\n  d: 4 # inner\ne: *x # alias\n".replace(
          "e: *x",
          "x: &x 5\ne: *x",
        ),
      );
      expect(at(doc, "a").trailing?.text).toBe("# one");
      expect(at(doc, "b").trailing?.text).toBe("# flow");
      expect(at(doc, "c", "d").trailing?.text).toBe("# inner");
      expect(at(doc, "c").trailing).toBeUndefined();
      expect(at(doc, "e").trailing?.text).toBe("# alias");
    });

    it("trails a block collection's row from its key's line", () => {
      const doc = ok("env: # note\n  - a\nmap: &m # named\n  k: v\n");
      expect(at(doc, "env").trailing?.text).toBe("# note");
      expect(at(doc, "env", 0).leading).toBeUndefined();
      expect(at(doc, "map").trailing?.text).toBe("# named");
    });

    it("trails a block scalar from its header's line", () => {
      const doc = ok("script: | # note\n  run\nnext: 1\n");
      expect(at(doc, "script").trailing?.text).toBe("# note");
      expect((doc.value as { script: string }).script).toBe("run\n");
    });

    it("leads the member a comment on its own line comes before", () => {
      const doc = ok(
        "a: 1\n# about b\n# and more\nb:\n  # first of b\n  c: 2\n  # about d\n  d: 3\nlist:\n  # first item\n  - x\n  # second item\n  - y\n",
      );
      expect(texts(at(doc, "b").leading)).toEqual(["# about b", "# and more"]);
      expect(texts(at(doc, "b", "c").leading)).toEqual(["# first of b"]);
      expect(texts(at(doc, "b", "d").leading)).toEqual(["# about d"]);
      expect(texts(at(doc, "list", 0).leading)).toEqual(["# first item"]);
      expect(texts(at(doc, "list", 1).leading)).toEqual(["# second item"]);
    });

    it("gives a comment after a block collection's last member to the innermost collection at or left of it", () => {
      const doc = ok(
        "outer:\n  inner:\n    - a\n    # inner's\n  # outer's\n# next's\nnext:\n  x: 1\n    # x's map's\n# the root's\n",
      );
      expect(texts(at(doc, "outer", "inner").dangling)).toEqual(["# inner's"]);
      expect(texts(at(doc, "outer").dangling)).toEqual(["# outer's"]);
      expect(texts(at(doc, "next").leading)).toEqual(["# next's"]);
      expect(texts(at(doc, "next").dangling)).toEqual(["# x's map's"]);
      expect(texts(at(doc).dangling)).toEqual(["# the root's"]);
    });

    it("places comments in a flow collection as parseJson places them in JSONC", () => {
      const doc = ok(
        "list: [ # opens\n  1, # one\n  # before two\n  2\n  # at the end\n]\n",
      );
      expect(at(doc, "list").trailing?.text).toBe("# opens");
      expect(at(doc, "list", 0).trailing?.text).toBe("# one");
      expect(texts(at(doc, "list", 1).leading)).toEqual(["# before two"]);
      expect(texts(at(doc, "list").dangling)).toEqual(["# at the end"]);
    });

    it("makes a single document's comments the root's", () => {
      const doc = ok("# before\n---\n# after the marker\na: 1\n# after\n");
      expect(texts(at(doc).leading)).toEqual([
        "# before",
        "# after the marker",
      ]);
      expect(texts(at(doc).dangling)).toEqual(["# after"]);
    });

    it("trails a comment between a key and its scalar value", () => {
      const doc = ok("a: # note\n  value\nb: 1\n");
      expect(at(doc, "a").trailing?.text).toBe("# note");
      expect((doc.value as { a: string }).a).toBe("value");
    });

    it("reads every comment once", () => {
      const doc = ok(PIPELINE);
      const seen: string[] = [];
      const visit = (facts: NodeFacts | undefined) => {
        if (!facts) return;
        for (const c of facts.leading ?? []) seen.push(c.text);
        if (facts.trailing) seen.push(facts.trailing.text);
        for (const c of facts.dangling ?? []) seen.push(c.text);
      };
      visit(at(doc));
      const walk = (value: unknown, path: (string | number)[]) => {
        if (value === null || typeof value !== "object") return;
        for (const key of Object.keys(value)) {
          const k = Array.isArray(value) ? Number(key) : key;
          if (k === "<<") continue;
          visit(at(doc, ...path, k));
          walk((value as Record<string, unknown>)[key], [...path, k]);
        }
      };
      walk(doc.value, []);
      expect(seen.sort()).toEqual(
        [
          "# Build pipeline for the sample service",
          "# pinned for the cache",
          "# more come from the runner",
        ].sort(),
      );
    });
  });

  describe("errors", () => {
    it("reports the first error's message, offset, line and column", () => {
      const error = fails("a: 1\nb: [1, 2\nc: 3\n");
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.message).not.toContain("\n");
      expect(error.line).toBeGreaterThanOrEqual(2);
      expect(error.offset).toBeGreaterThan(4);
    });

    it("reports a bad indent at its place", () => {
      const error = fails("a: 1\n b: 2\n");
      expect(error).toMatchObject({ line: 1, column: 4, offset: 3 });
    });

    it("never throws on deep nesting", () => {
      const depth = 5000;
      const text = `${"[".repeat(depth)}${"]".repeat(depth)}`;
      expect(() => readYaml(text)).not.toThrow();
      const result = readYaml(text);
      if (result.ok) {
        let value = result.document.value;
        let levels = 0;
        while (Array.isArray(value) && value.length > 0) {
          value = value[0];
          levels++;
        }
        expect(levels).toBe(depth - 1);
      }
    });
  });
});
