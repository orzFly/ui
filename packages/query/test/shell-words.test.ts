import { describe, expect, it } from "vitest";
import {
  quoteShellWord,
  segmentValue,
  shellWords,
} from "../src/shell-words.ts";

const values = (text: string) => shellWords(text).map((w) => w.value);

describe("shellWords", () => {
  it("splits on unquoted whitespace", () => {
    expect(values("  a b\tc\n d  ")).toEqual(["a", "b", "c", "d"]);
    expect(values("")).toEqual([]);
    expect(values("   ")).toEqual([]);
  });

  it("joins adjacent quoted and unquoted segments into one word", () => {
    expect(values(`ab"cd ef"`)).toEqual(["abcd ef"]);
    expect(values(`'a b'"c d"e\\ f`)).toEqual(["a bc de f"]);
  });

  it("reads a backslash as escaping the next character", () => {
    expect(values("a\\ b")).toEqual(["a b"]);
    expect(values("C:\\\\temp")).toEqual(["C:\\temp"]);
    expect(values("don\\'t")).toEqual(["don't"]);
    expect(values("\\🙂x")).toEqual(["🙂x"]);
  });

  it("keeps a trailing lone backslash literal", () => {
    const [word] = shellWords("ab\\");
    expect(word?.value).toBe("ab\\");
    expect(word?.segments).toEqual([{ start: 0, end: 3, quoted: "none" }]);
    expect(word?.unclosed).toBeUndefined();
  });

  it("reads single quotes literally, with no escapes", () => {
    expect(values("'a\\b \"c\"'")).toEqual(['a\\b "c"']);
    expect(values("''")).toEqual([""]);
  });

  it('allows only \\" and \\\\ inside double quotes', () => {
    expect(values(`"a\\"b"`)).toEqual(['a"b']);
    expect(values(`"a\\\\b"`)).toEqual(["a\\b"]);
    expect(values(`"a\\nb"`)).toEqual(["a\\nb"]);
    expect(values(`"don't"`)).toEqual(["don't"]);
    expect(values(`""`)).toEqual([""]);
  });

  it("treats shell metacharacters as ordinary", () => {
    expect(values("$HOME *.ts ~ a|b #c ;")).toEqual([
      "$HOME",
      "*.ts",
      "~",
      "a|b",
      "#c",
      ";",
    ]);
  });

  it("runs an unclosed single quote to the end", () => {
    const words = shellWords("a 'b c");
    expect(words).toHaveLength(2);
    expect(words[1]).toMatchObject({
      start: 2,
      end: 6,
      raw: "'b c",
      value: "b c",
      unclosed: true,
    });
  });

  it("runs an unclosed double quote to the end", () => {
    const words = shellWords(`x"b \\" c`);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ value: 'xb " c', unclosed: true });
    expect(shellWords(`"`)[0]).toMatchObject({ value: "", unclosed: true });
  });

  it("records offsets, raw text and segments", () => {
    const words = shellWords(`go a"b c"\\,d 'e'`);
    expect(words.map(({ start, end, raw }) => ({ start, end, raw }))).toEqual([
      { start: 0, end: 2, raw: "go" },
      { start: 3, end: 12, raw: `a"b c"\\,d` },
      { start: 13, end: 16, raw: "'e'" },
    ]);
    expect(words[1]?.segments).toEqual([
      { start: 3, end: 4, quoted: "none" },
      { start: 4, end: 9, quoted: "double" },
      { start: 9, end: 11, quoted: "escape" },
      { start: 11, end: 12, quoted: "none" },
    ]);
    expect(words[2]?.segments).toEqual([
      { start: 13, end: 16, quoted: "single" },
    ]);
  });

  it("shifts every offset by the offset argument", () => {
    const [word] = shellWords(`a"b"`, 10);
    expect(word).toMatchObject({
      start: 10,
      end: 14,
      raw: `a"b"`,
      value: "ab",
    });
    expect(word?.segments).toEqual([
      { start: 10, end: 11, quoted: "none" },
      { start: 11, end: 14, quoted: "double" },
    ]);
  });
});

describe("segmentValue", () => {
  it("rebuilds the value segment by segment", () => {
    for (const text of [
      `a"b c"\\,d'e'`,
      `"a\\"b\\\\"`,
      `'open`,
      `"open \\"`,
      `"x\\\\`,
      "tail\\",
    ]) {
      for (const offset of [0, 7]) {
        const [word] = shellWords(text, offset);
        if (word === undefined) throw new Error(text);
        const joined = word.segments.map((s) => segmentValue(word, s)).join("");
        expect(joined, text).toBe(word.value);
      }
    }
  });
});

describe("quoteShellWord", () => {
  it("leaves a safe value bare", () => {
    expect(quoteShellWord("kind:bug")).toBe("kind:bug");
    expect(quoteShellWord("部署")).toBe("部署");
  });

  it("prefers single quotes, then double", () => {
    expect(quoteShellWord("In Progress")).toBe("'In Progress'");
    expect(quoteShellWord("Won't fix")).toBe(`"Won't fix"`);
    expect(quoteShellWord("")).toBe("''");
  });

  it("quotes commas and braces", () => {
    expect(quoteShellWord("a,b")).toBe("'a,b'");
    expect(quoteShellWord("{draft}")).toBe("'{draft}'");
  });

  it("round-trips through shellWords", () => {
    for (const value of [
      "plain",
      "In Progress",
      "Won't fix",
      `say "hi"`,
      `both ' and "`,
      "C:\\temp",
      `back\\slash "and' quote`,
      "trailing\\",
      "a,b",
      "{a,b}",
      " lead and trail ",
      "",
    ]) {
      const words = shellWords(quoteShellWord(value));
      expect(
        words.map((w) => w.value),
        value,
      ).toEqual([value]);
      expect(words[0]?.unclosed, value).toBeUndefined();
    }
  });
});
