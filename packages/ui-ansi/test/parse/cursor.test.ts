import { describe, expect, it } from "vitest";

import { type AnsiStyle, parseAnsi } from "../../src/parse/index.ts";

/** The first line as `[text, style]` runs. */
function runsOf(input: string): [string, AnsiStyle][] {
  const { lines, styles } = parseAnsi(input);
  const line = lines[0];
  if (!line) throw new Error("no line");
  const out: [string, AnsiStyle][] = [];
  for (let i = 0; i < line.runs.length; i += 2) {
    const from = line.runs[i] as number;
    const to =
      i + 2 < line.runs.length
        ? (line.runs[i + 2] as number)
        : line.text.length;
    out.push([
      line.text.slice(from, to),
      styles[line.runs[i + 1] as number] as AnsiStyle,
    ]);
  }
  return out;
}

const first = (input: string) => parseAnsi(input).lines[0];
const red = { fg: { kind: "palette", index: 1 } } as const;

describe("carriage return", () => {
  it("overwrites from column 0", () => {
    expect(first("hello\rjo")).toMatchObject({ text: "jollo", cells: 5 });
  });

  it("is not a carriage return before \\n", () => {
    const { lines } = parseAnsi("ab\r\ncd\r\n");
    expect(lines.map((l) => l.text)).toEqual(["ab", "cd", ""]);
  });

  it("leaves a progress bar in its final state", () => {
    const bar = (n: number) =>
      `\x1b[32m${"█".repeat(n)}\x1b[0m${"░".repeat(10 - n)} ${n * 10}%`;
    const input = `Downloading\n${[0, 3, 6, 10].map(bar).join("\r")}\ndone\n`;
    const { lines } = parseAnsi(input);
    expect(lines.map((l) => l.text)).toEqual([
      "Downloading",
      `${"█".repeat(10)} 100%`,
      "done",
      "",
    ]);
    expect(lines[1]?.cells).toBe(15);
    expect([...(lines[1]?.runs ?? [])]).toEqual([0, 1, 10, 0]);
  });

  it("keeps the overwritten text's style where nothing is written", () => {
    expect(runsOf("\x1b[31mabcd\x1b[0m\rxy")).toEqual([
      ["xy", {}],
      ["cd", red],
    ]);
  });

  it("does nothing on an empty line", () => {
    expect(first("\rab")).toMatchObject({ text: "ab", cells: 2 });
  });
});

describe("backspace", () => {
  it("moves back one cell", () => {
    expect(first("abc\bX")).toMatchObject({ text: "abX", cells: 3 });
    expect(first("abc\b\bX")).toMatchObject({ text: "aXc", cells: 3 });
  });

  it("stops at column 0", () => {
    expect(first("\bab")).toMatchObject({ text: "ab" });
    expect(first("a\b\b\bX")).toMatchObject({ text: "X", cells: 1 });
  });
});

describe("tab", () => {
  it("advances to the next multiple of 8", () => {
    expect(first("\tx").text).toBe(`${" ".repeat(8)}x`);
    expect(first("abc\tx").text).toBe(`abc${" ".repeat(5)}x`);
    expect(first("12345678\tx").text).toBe(`12345678${" ".repeat(8)}x`);
    expect(first("abc\tx")?.cells).toBe(9);
  });

  it("fills in the current style", () => {
    expect(runsOf("a\x1b[31m\tb")).toEqual([
      ["a", {}],
      [`${" ".repeat(7)}b`, red],
    ]);
  });

  it("moves over existing text without erasing it", () => {
    expect(first("abcdefghijk\r\tX").text).toBe("abcdefghXjk");
  });

  it("counts wide characters as two cells", () => {
    expect(first("中\tx").text).toBe(`中${" ".repeat(6)}x`);
  });
});

describe("CSI C, D and G", () => {
  it("C moves forward, padding with default-style spaces", () => {
    expect(runsOf("\x1b[31ma\x1b[3Cb")).toEqual([
      ["a", red],
      ["   ", {}],
      ["b", red],
    ]);
    expect(first("a\x1b[Cb").text).toBe("a b");
    expect(first("a\x1b[0Cb").text).toBe("a b");
  });

  it("C over existing text moves without erasing", () => {
    expect(first("abcdef\r\x1b[2CX").text).toBe("abXdef");
  });

  it("D moves back, not past column 0", () => {
    expect(first("abcdef\x1b[2DX").text).toBe("abcdXf");
    expect(first("abc\x1b[99DX").text).toBe("Xbc");
    expect(first("\x1b[5DX").text).toBe("X");
  });

  it("G moves to a 1-based column", () => {
    expect(first("abcdef\x1b[3GX").text).toBe("abXdef");
    expect(first("abcdef\x1b[GX").text).toBe("Xbcdef");
  });

  it("G beyond the end pads", () => {
    expect(first("ab\x1b[5GX")).toMatchObject({ text: "ab  X", cells: 5 });
    expect(first("ab\x1b[5G")).toMatchObject({ text: "ab  ", cells: 4 });
    expect(first("abcdef\r\x1b[9GX").text).toBe("abcdef  X");
  });

  it("caps the distance one move pads", () => {
    expect(first("\x1b[99999999C")?.cells).toBe(1024);
    expect(first("\x1b[99999999G")?.cells).toBe(1023);
  });
});

describe("CSI K", () => {
  it("0K erases from the cursor to the end", () => {
    expect(first("abcdef\r\x1b[2C\x1b[K")).toMatchObject({
      text: "ab",
      cells: 2,
    });
    expect(first("abcdef\r\x1b[2C\x1b[0KX").text).toBe("abX");
    expect(first("abc\x1b[K").text).toBe("abc");
  });

  it("1K blanks the cells up to and under the cursor", () => {
    expect(runsOf("\x1b[31mabcdef\x1b[3G\x1b[1K")).toEqual([
      ["   ", {}],
      ["def", red],
    ]);
    expect(first("abc\x1b[1K")).toMatchObject({ text: "   ", cells: 3 });
  });

  it("2K erases the whole line without moving the cursor", () => {
    expect(first("abcdef\x1b[2K")).toMatchObject({ text: "", cells: 0 });
    expect(first("abcdef\x1b[3G\x1b[2KX").text).toBe("  X");
    expect(first("progress 50%\x1b[2K\rdone").text).toBe("done");
  });

  it("a line with no text after erasing has no runs", () => {
    expect(first("\x1b[31mabc\x1b[2K")?.runs.length).toBe(0);
  });

  it("0K at column 0 drops zero-width code points with no cell", () => {
    expect(first("\u0301\x1b[K")).toMatchObject({ text: "", cells: 0 });
    expect(first("x\r\u0301\x1b[K")).toMatchObject({ text: "", cells: 0 });
  });

  it("ignores other modes", () => {
    expect(first("abc\r\x1b[3K").text).toBe("abc");
  });
});

describe("wide characters in the cell buffer", () => {
  it("overwriting the left half blanks the right half", () => {
    expect(first("中文\rx")).toMatchObject({ text: "x 文", cells: 4 });
  });

  it("overwriting the right half blanks the left half", () => {
    expect(first("中文\r\x1b[Cx")).toMatchObject({ text: " x文", cells: 4 });
  });

  it("a wide character over two narrow ones", () => {
    expect(first("abc\r中")).toMatchObject({ text: "中c", cells: 3 });
    expect(first("ab中\r\x1b[C文")).toMatchObject({ text: "a文 ", cells: 4 });
  });

  it("0K through the right half blanks the left half", () => {
    expect(first("a中b\x1b[3G\x1b[K")).toMatchObject({ text: "a ", cells: 2 });
  });

  it("1K ending on the left half blanks the right half", () => {
    expect(first("a中b\x1b[2G\x1b[1K")).toMatchObject({
      text: "   b",
      cells: 4,
    });
  });
});

describe("the cell buffer", () => {
  it("builds the same line as the fast path for text that only moves forward", () => {
    const E = "\x1b";
    const tokens = [
      "a",
      "中",
      "\u0301",
      "\u{1f600}",
      "\t",
      `${E}[3C`,
      `${E}[5G`,
      `${E}[K`,
      `${E}[31m`,
      `${E}[0m`,
      `${E}]8;;https://app.example${E}\\`,
      `${E}]8;;\x07`,
      "\u200d",
      "\ufe0f",
      "\ud83d",
      "\ude00",
      "\n",
      "\r\n",
    ];
    const view = (input: string) => {
      const { lines, styles, maxCells } = parseAnsi(input);
      return {
        lines: lines.map((l) => ({
          text: l.text,
          cells: l.cells,
          runs: [...l.runs].map((v, i) => (i % 2 ? styles[v] : v)),
        })),
        maxCells,
      };
    };
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 3000; round++) {
      let text = "";
      const n = Math.floor(random() * 12);
      for (let j = 0; j < n; j++)
        text += tokens[Math.floor(random() * tokens.length)];
      // "Z\rZ" draws "Z" too, but puts the rest of the line in the cell buffer.
      const fast = view(`Z${text.replace(/\n/g, "\nZ")}`);
      const slow = view(`Z\rZ${text.replace(/\n/g, "\nZ\rZ")}`);
      if (JSON.stringify(slow) !== JSON.stringify(fast))
        expect({ text, slow }).toEqual({ text, slow: fast });
    }
  });
});
