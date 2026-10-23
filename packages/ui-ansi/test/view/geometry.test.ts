import { cellWidth } from "@orz/ui/lib/cell-width";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../src/parse/parser.ts";
import {
  buildRowIndex,
  columnsFor,
  lineAtRow,
  rowsForLine,
  splitRows,
  VIRTUALIZE_ABOVE,
} from "../../src/view/geometry.ts";

function line(text: string) {
  let cells = 0;
  for (const char of text) cells += cellWidth(char.codePointAt(0) as number);
  return { text, cells };
}

describe("columnsFor", () => {
  it("floors the width to whole cells", () => {
    expect(columnsFor(800, 8)).toBe(100);
    expect(columnsFor(807.9, 8)).toBe(100);
    expect(columnsFor(800, 7.5)).toBe(106);
  });

  it("keeps at least 20 columns", () => {
    expect(columnsFor(100, 8)).toBe(20);
    expect(columnsFor(0, 8)).toBe(20);
    expect(columnsFor(800, 0)).toBe(20);
  });
});

describe("rowsForLine", () => {
  it("takes one row for an empty or fitting line", () => {
    expect(rowsForLine(0, 20)).toBe(1);
    expect(rowsForLine(20, 20)).toBe(1);
  });

  it("takes a row per started block of columns", () => {
    expect(rowsForLine(21, 20)).toBe(2);
    expect(rowsForLine(40, 20)).toBe(2);
    expect(rowsForLine(41, 20)).toBe(3);
  });
});

describe("splitRows", () => {
  it("yields one empty row for an empty line", () => {
    expect(splitRows(line(""), 20)).toEqual([[0, 0, 0]]);
  });

  it("cuts narrow text at every column count", () => {
    expect(splitRows(line("abcdefg"), 3)).toEqual([
      [0, 3, 0],
      [3, 6, 3],
      [6, 7, 6],
    ]);
    expect(splitRows(line("abcdef"), 3)).toEqual([
      [0, 3, 0],
      [3, 6, 3],
    ]);
  });

  it("moves a wide character that would straddle the cut to the next row", () => {
    // "ab" + 中 needs 4 cells; at 3 columns 中 starts row two.
    expect(splitRows(line("ab中c"), 3)).toEqual([
      [0, 2, 0],
      [2, 4, 2],
    ]);
  });

  it("keeps a wide character that ends exactly at the cut", () => {
    expect(splitRows(line("a中b"), 3)).toEqual([
      [0, 2, 0],
      [2, 3, 3],
    ]);
  });

  it("counts a surrogate pair as one code point", () => {
    // U+1F600 is wide and two UTF-16 units long.
    expect(splitRows(line("a\u{1F600}\u{1F600}"), 3)).toEqual([
      [0, 3, 0],
      [3, 5, 3],
    ]);
  });

  it("keeps a zero-width code point with the character before it", () => {
    // U+0301 combines with the "c" that fills the first row.
    expect(splitRows(line("abc\u0301d"), 3)).toEqual([
      [0, 4, 0],
      [4, 5, 3],
    ]);
  });

  it("keeps a zero-width code point with a pushed wide character", () => {
    expect(splitRows(line("ab中\u0301"), 3)).toEqual([
      [0, 2, 0],
      [2, 4, 2],
    ]);
  });

  it("keeps a leading zero-width code point on the first row", () => {
    expect(splitRows(line("\u0301abcd"), 3)).toEqual([
      [0, 4, 0],
      [4, 5, 3],
    ]);
  });

  it("never splits a surrogate pair at a cut", () => {
    expect(splitRows(line("ab\u{1F600}"), 3)).toEqual([
      [0, 2, 0],
      [2, 4, 2],
    ]);
  });

  it("splits a 3 MiB line quickly", () => {
    const big = line("ab中\u{1F600}e\u0301".repeat(500_000));
    const start = performance.now();
    const rows = splitRows(big, 80);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(rows.at(-1)?.[1]).toBe(big.text.length);
  });

  it("puts a lone wide character on its own row when cols is too narrow", () => {
    expect(splitRows(line("中中"), 1)).toEqual([
      [0, 1, 0],
      [1, 2, 2],
    ]);
  });
});

describe("buildRowIndex", () => {
  it("is one row per line without wrap", () => {
    const lines = [line("a".repeat(100)), line(""), line("中".repeat(50))];
    expect([...buildRowIndex(lines, null)]).toEqual([0, 1, 2, 3]);
  });

  it("is a prefix sum of rows per line", () => {
    const lines = [
      line("a".repeat(20)),
      line("a".repeat(21)),
      line(""),
      line("a".repeat(41)),
    ];
    expect([...buildRowIndex(lines, 20)]).toEqual([0, 1, 3, 4, 7]);
  });

  it("counts the extra row a pushed wide character adds", () => {
    // 40 cells fill two rows of 20 only if no cut is wasted; 中 leaves cell 20 empty.
    const pushed = line(`${"a".repeat(19)}中${"b".repeat(19)}`);
    expect(pushed.cells).toBe(40);
    expect(rowsForLine(pushed.cells, 20)).toBe(2);
    expect(splitRows(pushed, 20)).toEqual([
      [0, 19, 0],
      [19, 38, 19],
      [38, 39, 39],
    ]);
    expect([...buildRowIndex([pushed, line("x")], 20)]).toEqual([0, 3, 4]);
  });

  it("agrees with splitRows on mixed lines", () => {
    const lines = [
      line(""),
      line("a".repeat(57)),
      line(`${"a".repeat(19)}中`.repeat(5)),
      line("中".repeat(31)),
      line(`ab\u0301${"\u{1F600}".repeat(15)}`),
      line("e\u0301".repeat(45)),
    ];
    const index = buildRowIndex(lines, 20);
    lines.forEach((l, i) => {
      expect(index[i + 1] - index[i]).toBe(splitRows(l, 20).length);
    });
  });

  it("has no wide code point below U+1100, which its fast path assumes", () => {
    const wide: number[] = [];
    for (let cp = 0; cp < 0x1100; cp++) if (cellWidth(cp) === 2) wide.push(cp);
    expect(wide).toEqual([]);
  });

  it("agrees with splitRows on random mixed text at every column count", () => {
    const pieces = ["a", "b", " ", "中", "\u{1F600}", "\u0301", "\u200d", "é"];
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const lines = Array.from({ length: 400 }, () => {
      let text = "";
      const n = Math.floor(random() * 90);
      for (let i = 0; i < n; i++)
        text += pieces[Math.floor(random() * pieces.length)];
      return line(text);
    });
    for (const cols of [20, 21, 23, 40]) {
      const index = buildRowIndex(lines, cols);
      lines.forEach((l, i) => {
        const rows = splitRows(l, cols);
        expect(index[i + 1] - index[i]).toBe(rows.length);
        expect(rows.map(([from, to]) => l.text.slice(from, to)).join("")).toBe(
          l.text,
        );
        for (const [from, to] of rows) {
          expect(line(l.text.slice(from, to)).cells).toBeLessThanOrEqual(cols);
        }
      });
    }
  });

  it("finds every row's line from its own index", () => {
    const lines = [
      line("a".repeat(45)),
      line(""),
      line(`${"a".repeat(19)}中b`),
      line("x"),
    ];
    const index = buildRowIndex(lines, 20);
    for (let i = 0; i < lines.length; i++) {
      for (let row = index[i]; row < index[i + 1]; row++) {
        expect(lineAtRow(index, row)).toBe(i);
      }
    }
  });

  it("extends an index over a prefix to the same result", () => {
    const lines = Array.from({ length: 300 }, (_, i) =>
      line(i % 3 ? "a".repeat(i % 70) : `${"a".repeat(19)}中`.repeat(3)),
    );
    for (const cols of [null, 20, 33]) {
      let index = buildRowIndex(lines.slice(0, 1), cols);
      for (const n of [1, 2, 50, 51, 200, 300]) {
        const prev = index;
        const prevCopy = [...prev];
        index = buildRowIndex(lines.slice(0, n), cols, prev);
        expect([...index]).toEqual([...buildRowIndex(lines.slice(0, n), cols)]);
        // The earlier index still reads as it did.
        expect([...prev]).toEqual(prevCopy);
      }
    }
  });

  it("is empty but for the total when there are no lines", () => {
    expect([...buildRowIndex([], 20)]).toEqual([0]);
  });

  it("indexes a million lines quickly", () => {
    const long = line("x".repeat(130));
    const lines = Array.from({ length: 1_000_000 }, (_, i) =>
      i % 10 ? line("short") : long,
    );
    // The first call pays for JIT and string flattening, which a re-wrap does not.
    buildRowIndex(lines, 80);
    const start = performance.now();
    const index = buildRowIndex(lines, 80);
    const elapsed = performance.now() - start;
    expect(index[lines.length]).toBe(1_100_000);
    expect(elapsed).toBeLessThan(100);
  });
});

describe("lineAtRow", () => {
  // Rows: line 0 is 0, line 1 is 1–2, line 2 is 3, line 3 is 4–6.
  const index = Uint32Array.from([0, 1, 3, 4, 7]);

  it("finds the line at each line's first and last row", () => {
    expect(lineAtRow(index, 0)).toBe(0);
    expect(lineAtRow(index, 1)).toBe(1);
    expect(lineAtRow(index, 2)).toBe(1);
    expect(lineAtRow(index, 3)).toBe(2);
    expect(lineAtRow(index, 4)).toBe(3);
    expect(lineAtRow(index, 6)).toBe(3);
  });

  it("clamps rows outside the index", () => {
    expect(lineAtRow(index, -5)).toBe(0);
    expect(lineAtRow(index, 7)).toBe(3);
    expect(lineAtRow(index, 1e9)).toBe(3);
  });

  it("returns 0 for an empty index", () => {
    expect(lineAtRow(Uint32Array.from([0]), 3)).toBe(0);
  });
});

it("virtualises above 5,000 rows", () => {
  expect(VIRTUALIZE_ABOVE).toBe(5000);
});

describe("geometry agrees with the parse", () => {
  const samples = [
    "ab\x1b[10Cx",
    "a\tb",
    "中\x1b[5G文",
    "éx",
    "\x00\x01abc\x7f",
    "a​b",
    "x\x1b[3D中",
    "\u{1F600}a",
    "a\x85b\x90c",
    "abc\x1b[1K",
    "中文\b\bx",
    "abc\x1b[2Dd",
    "中文\x1b[3D\x1b[K",
    "abcdef\x1b[3Gx\x1b[0K",
    "é́x",
    "\x1b[30C中",
  ];

  it("a line's cells are the sum of its code points' widths", () => {
    for (const s of samples) {
      for (const line of parseAnsi(s).lines) {
        let sum = 0;
        for (const ch of line.text) sum += cellWidth(ch.codePointAt(0) ?? 0);
        expect([s, line.text, sum]).toEqual([s, line.text, line.cells]);
      }
    }
  });

  it("the row index counts the rows splitRows makes", () => {
    for (const s of samples) {
      const long = `${s}${"中".repeat(15)}${s}${"y".repeat(9)}${s}`;
      const { lines } = parseAnsi(long);
      for (const cols of [20, 21, 33]) {
        const index = buildRowIndex(lines, cols);
        const split = lines.reduce(
          (n, l) => n + (l.cells <= cols ? 1 : splitRows(l, cols).length),
          0,
        );
        expect([long, cols, index[lines.length]]).toEqual([long, cols, split]);
      }
    }
  });
});
