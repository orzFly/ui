import { describe, expect, it } from "vitest";

import { createAnsiParser, parseAnsi } from "../../src/parse/index.ts";

const texts = (input: string) => parseAnsi(input).lines.map((l) => l.text);
const red = { fg: { kind: "palette", index: 1 } } as const;

describe("dropped sequences", () => {
  it("drops CSI sequences that need a screen", () => {
    expect(texts("a\x1b[2Jb\x1b[Hc\x1b[3Ad\x1b[1;24re\x1b[5Sf")).toEqual([
      "abcdef",
    ]);
  });

  it("drops CSI with private markers or intermediates", () => {
    expect(texts("a\x1b[?25lb\x1b[?2004hc\x1b[>0cd\x1b[=1Ce\x1b[2 qf")).toEqual(
      ["abcdef"],
    );
    expect(texts("abc\x1b[?1D\x1b[?1KX")).toEqual(["abcX"]);
  });

  it("drops OSC other than 8, with either terminator", () => {
    expect(
      texts("a\x1b]0;title\x07b\x1b]2;title\x1b\\c\x1b]133;A\x07d"),
    ).toEqual(["abcd"]);
  });

  it("drops DCS, SOS, PM and APC up to ST", () => {
    expect(
      texts(
        "a\x1bPq#0;2;0;0;0\x1b\\b\x1bXsos\x1b\\c\x1b^pm\x1b\\d\x1b_apc\x07x\x1b\\e",
      ),
    ).toEqual(["abcde"]);
  });

  it("drops two-byte and intermediate escapes", () => {
    expect(texts("a\x1b(Bb\x1b)0c\x1b7d\x1b8e\x1b=f\x1b#8g\x1bMh")).toEqual([
      "abcdefgh",
    ]);
  });

  it("drops other C0 controls, DEL and C1 code points", () => {
    expect(texts("a\x00b\x07c\x0bd\x0ce\x7ff\x85g\x9bh\x9di\x18j")).toEqual([
      "abcdefghij",
    ]);
  });

  it("drops a lone ESC and reads what follows it", () => {
    expect(texts("a\x1b\nb")).toEqual(["a", "b"]);
    expect(texts("a\x1b\x1b[31mb")).toEqual(["ab"]);
    expect(parseAnsi("a\x1b\x1b[31mb").styles).toEqual([{}, red]);
    expect(texts("a\x1bé")).toEqual(["aé"]);
  });

  it("CAN and SUB cancel a sequence", () => {
    expect(texts("a\x1b[31\x18mb\x1b]8;;x\x1ac")).toEqual(["ambc"]);
    expect(parseAnsi("a\x1b[31\x18mb").styles).toEqual([{}]);
  });

  it("runs \\n, \\r, \\b and \\t met inside a CSI", () => {
    expect(texts("a\x1b[3\n1mb")).toEqual(["a", "b"]);
    expect(parseAnsi("a\x1b[3\n1mb").styles).toEqual([{}, red]);
  });

  it("ends a CSI at a character that cannot be in one", () => {
    expect(texts("a\x1b[31中b")).toEqual(["a中b"]);
  });

  it("drops a CSI whose parameters run past 256 characters", () => {
    const long = `${"1;".repeat(200)}31`;
    expect(texts(`a\x1b[${long}mb`)).toEqual(["ab"]);
    expect(parseAnsi(`a\x1b[${long}mb`).styles).toEqual([{}]);
    const fits = `${"0;".repeat(126)}31`;
    expect(parseAnsi(`\x1b[${fits}mb`).styles).toEqual([{}, red]);
  });
});

describe("unterminated sequences", () => {
  it("drops an unterminated escape at the end", () => {
    for (const tail of [
      "\x1b",
      "\x1b[",
      "\x1b[31",
      "\x1b]8;;https://example.com",
      "\x1bP",
      "\x1b(",
      "\x1b]0;x\x1b",
    ]) {
      expect(texts(`abc${tail}`)).toEqual(["abc"]);
    }
  });

  it("releases an OSC once its body passes 4 KiB", () => {
    const body = "x".repeat(4096);
    expect(texts(`a\x1b]0;${body.slice(2)}\x07b`)).toEqual(["ab"]);
    expect(texts(`a\x1b]${body}\x07b`)).toEqual(["ab"]);
    expect(texts(`a\x1b]${body}yz\nnext`)).toEqual(["ayz", "next"]);
    expect(texts(`a\x1b]${body}\x1b[31mb`)).toEqual(["ab"]);
  });

  it("an unterminated OSC does not swallow the rest of the log", () => {
    const log = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const lines = texts(`\x1b]8;;https://example.com/${log}`);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.at(-1)).toBe("line 499");
  });

  it("releases DCS, SOS, PM and APC strings past 4 KiB", () => {
    const body = "x".repeat(4096);
    expect(texts(`a\x1bP${body}\x1b\\b`)).toEqual(["ab"]);
    expect(texts(`a\x1b_${body}yz`)).toEqual(["ayz"]);
  });
});

describe("lines", () => {
  it("ends a line at \\n and at \\r\\n", () => {
    expect(texts("a\nb\r\nc")).toEqual(["a", "b", "c"]);
    expect(texts("a\r\r\nb")).toEqual(["a", "b"]);
  });

  it("carries the style over a newline", () => {
    const { lines, styles } = parseAnsi("\x1b[31ma\nb\x1b[0m\nc");
    expect(styles).toEqual([{}, red]);
    expect([...(lines[0]?.runs ?? [])]).toEqual([0, 1]);
    expect([...(lines[1]?.runs ?? [])]).toEqual([0, 1]);
    expect([...(lines[2]?.runs ?? [])]).toEqual([0, 0]);
  });

  it("flushes the last line, even when empty", () => {
    expect(texts("")).toEqual([""]);
    expect(texts("a")).toEqual(["a"]);
    expect(texts("a\n")).toEqual(["a", ""]);
    expect(texts("\n\n")).toEqual(["", "", ""]);
  });

  it("gives a line with no text no runs and no cells", () => {
    const [line] = parseAnsi("\x1b[31m").lines;
    expect(line?.runs).toHaveLength(0);
    expect(line?.cells).toBe(0);
    expect(line?.text).toBe("");
  });

  it("keeps runs ascending, starting at 0, never empty", () => {
    const { lines } = parseAnsi(
      "\x1b[31ma\x1b[32m\x1b[33mb\x1b[0m\tc\x1b[1m\x1b[22md\re\x1b[2Cf",
    );
    const runs = lines[0]?.runs ?? new Uint32Array();
    expect(runs[0]).toBe(0);
    for (let i = 2; i < runs.length; i += 2) {
      expect(runs[i] as number).toBeGreaterThan(runs[i - 2] as number);
      expect(runs[i + 1]).not.toBe(runs[i - 1]);
    }
    expect(runs[runs.length - 2] as number).toBeLessThan(
      lines[0]?.text.length ?? 0,
    );
  });

  it("tracks maxCells", () => {
    expect(parseAnsi("").maxCells).toBe(0);
    expect(parseAnsi("ab\nabcd\nabc").maxCells).toBe(4);
  });
});

describe("createAnsiParser", () => {
  it("exposes complete lines as they arrive", () => {
    const parser = createAnsiParser();
    parser.push("a\nb");
    expect(parser.lines.map((l) => l.text)).toEqual(["a"]);
    expect(parser.maxCells).toBe(1);
    parser.push("cd\n");
    expect(parser.lines.map((l) => l.text)).toEqual(["a", "bcd"]);
    parser.end();
    expect(parser.lines.map((l) => l.text)).toEqual(["a", "bcd", ""]);
    expect(parser.maxCells).toBe(3);
  });

  it("treats a second end as a no-op", () => {
    const parser = createAnsiParser();
    parser.push("x");
    parser.end();
    parser.end();
    expect(parser.lines).toHaveLength(1);
  });

  it("refuses a push after end", () => {
    const parser = createAnsiParser();
    parser.end();
    expect(() => parser.push("x")).toThrow();
  });
});
