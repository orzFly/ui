import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../src/parse/index.ts";
import { applySgr } from "../../src/parse/sgr.ts";
import type { AnsiStyle } from "../../src/parse/types.ts";

const sgr = (params: string, from: AnsiStyle = {}) =>
  applySgr(
    from,
    params.split(";").map((p) => p.split(":")),
  );

const palette = (index: number) => ({ kind: "palette", index }) as const;
const rgb = (r: number, g: number, b: number) =>
  ({ kind: "rgb", r, g, b }) as const;

describe("applySgr", () => {
  it.each([
    ["1", { bold: true }],
    ["2", { dim: true }],
    ["3", { italic: true }],
    ["4", { underline: "single" }],
    ["5", { blink: true }],
    ["6", { blink: true }],
    ["7", { inverse: true }],
    ["8", { hidden: true }],
    ["9", { strike: true }],
    ["21", { underline: "double" }],
    ["53", { overline: true }],
    ["4:1", { underline: "single" }],
    ["4:2", { underline: "double" }],
    ["4:3", { underline: "curly" }],
    ["4:4", { underline: "dotted" }],
    ["4:5", { underline: "dashed" }],
  ])("sets %s", (params, style) => {
    expect(sgr(params)).toEqual(style);
  });

  it.each([
    ["22", { bold: true, dim: true }],
    ["23", { italic: true }],
    ["24", { underline: "curly" }],
    ["4:0", { underline: "double" }],
    ["25", { blink: true }],
    ["27", { inverse: true }],
    ["28", { hidden: true }],
    ["29", { strike: true }],
    ["55", { overline: true }],
    ["39", { fg: palette(1) }],
    ["49", { bg: palette(2) }],
    ["59", { underlineColor: palette(3) }],
  ] as [string, AnsiStyle][])("%s turns its attribute off", (params, from) => {
    expect(sgr(params, from)).toEqual({});
  });

  it("22 leaves the other attributes alone", () => {
    expect(sgr("22", { bold: true, italic: true })).toEqual({ italic: true });
  });

  it("0, an empty list and an empty parameter reset everything", () => {
    const all: AnsiStyle = {
      fg: palette(1),
      bg: rgb(1, 2, 3),
      underlineColor: palette(200),
      bold: true,
      dim: true,
      italic: true,
      underline: "curly",
      blink: true,
      inverse: true,
      hidden: true,
      strike: true,
      overline: true,
    };
    expect(sgr("0", all)).toEqual({});
    expect(sgr("", all)).toEqual({});
    expect(applySgr(all, [])).toEqual({});
    expect(sgr(";31", all)).toEqual({ fg: palette(1) });
  });

  it("maps the 16 palette codes", () => {
    for (let i = 0; i < 8; i++) {
      expect(sgr(String(30 + i))).toEqual({ fg: palette(i) });
      expect(sgr(String(90 + i))).toEqual({ fg: palette(8 + i) });
      expect(sgr(String(40 + i))).toEqual({ bg: palette(i) });
      expect(sgr(String(100 + i))).toEqual({ bg: palette(8 + i) });
    }
  });

  it.each([
    ["38;5;196", { fg: palette(196) }],
    ["48;5;16", { bg: palette(16) }],
    ["58;5;9", { underlineColor: palette(9) }],
    ["38:5:196", { fg: palette(196) }],
    ["48:5:16", { bg: palette(16) }],
    ["58:5:9", { underlineColor: palette(9) }],
    ["38;2;10;20;30", { fg: rgb(10, 20, 30) }],
    ["48;2;0;0;255", { bg: rgb(0, 0, 255) }],
    ["58;2;1;2;3", { underlineColor: rgb(1, 2, 3) }],
    ["38:2::10:20:30", { fg: rgb(10, 20, 30) }],
    ["38:2:10:20:30", { fg: rgb(10, 20, 30) }],
    ["48:2:0:1:2:3", { bg: rgb(1, 2, 3) }],
    ["58:2::1:2:3", { underlineColor: rgb(1, 2, 3) }],
    ["38;5;", { fg: palette(0) }],
  ] as [string, AnsiStyle][])(
    "reads the extended colour %s",
    (params, style) => {
      expect(sgr(params)).toEqual(style);
    },
  );

  it("applies the codes after an extended colour", () => {
    expect(sgr("38;5;1;1")).toEqual({ fg: palette(1), bold: true });
    expect(sgr("38;2;1;2;3;4")).toEqual({
      fg: rgb(1, 2, 3),
      underline: "single",
    });
    expect(sgr("38:5:1;1")).toEqual({ fg: palette(1), bold: true });
  });

  it("a malformed extended colour consumes its arguments and changes nothing", () => {
    const from: AnsiStyle = { fg: palette(2) };
    expect(sgr("38;5", from)).toEqual(from);
    expect(sgr("38", from)).toEqual(from);
    expect(sgr("38;5;300", from)).toEqual(from);
    expect(sgr("38;5;300;1", from)).toEqual({ ...from, bold: true });
    expect(sgr("38;2;1;2", from)).toEqual(from);
    expect(sgr("38;2;1;2;256", from)).toEqual(from);
    expect(sgr("38:5:300", from)).toEqual(from);
    expect(sgr("38:2:1:2", from)).toEqual(from);
    expect(sgr("48:9:1", from)).toEqual(from);
  });

  it("never reads an extended colour's arguments as codes", () => {
    // 38;5;1 would make text bold if the 1 were read as a code.
    expect(sgr("38;5;1")).toEqual({ fg: palette(1) });
    expect(sgr("38;2;1;4;9")).toEqual({ fg: rgb(1, 4, 9) });
  });

  it("ignores unknown codes and unknown underline styles", () => {
    expect(sgr("10;20;26;50;60;65;99;108")).toEqual({});
    expect(sgr("4:6", { underline: "curly" })).toEqual({ underline: "curly" });
  });

  it("does not change the style it is given", () => {
    const from: AnsiStyle = { bold: true };
    sgr("0;31", from);
    expect(from).toEqual({ bold: true });
  });
});

describe("SGR in the parser", () => {
  it("interns styles with id 0 as the empty style", () => {
    const parse = parseAnsi("a\x1b[31mb\x1b[0mc\x1b[31md");
    expect(parse.styles).toEqual([{}, { fg: palette(1) }]);
    expect([...(parse.lines[0]?.runs ?? [])]).toEqual([0, 0, 1, 1, 2, 0, 3, 1]);
  });

  it("merges runs whose style does not change", () => {
    const parse = parseAnsi("\x1b[1ma\x1b[1mb\x1b[31m\x1b[39mc");
    expect([...(parse.lines[0]?.runs ?? [])]).toEqual([0, 1]);
    expect(parse.lines[0]?.text).toBe("abc");
  });

  it("gives equal styles one id, whatever order set them", () => {
    const parse = parseAnsi(
      "\x1b[1;31ma\x1b[0m\n\x1b[31;1mb\x1b[0m\n\x1b[31m\x1b[1;4mc\x1b[24md",
    );
    expect(parse.styles).toEqual([
      {},
      { fg: palette(1), bold: true },
      { fg: palette(1), bold: true, underline: "single" },
    ]);
    expect(parse.lines.map((l) => [...l.runs])).toEqual([
      [0, 1],
      [0, 1],
      [0, 2, 1, 1],
    ]);
  });

  it("does not intern a style no text is written in", () => {
    const parse = parseAnsi("\x1b[31m\x1b[32m\x1b[0mx");
    expect(parse.styles).toEqual([{}]);
  });

  it("drops a CSI ? … m rather than reading it as SGR", () => {
    const parse = parseAnsi("\x1b[?1mx\x1b[>4;1mx\x1b[1 mx");
    expect(parse.styles).toEqual([{}]);
    expect(parse.lines[0]?.text).toBe("xxx");
  });

  it("applies a repeated sequence to the state it meets", () => {
    const parse = parseAnsi(
      "\x1b[1ma\x1b[0m\x1b[31m\x1b[1mb\x1b[0m\x1b[1mc\x1b]8;;https://example.com\x07\x1b[1md",
    );
    expect(parse.styles).toEqual([
      {},
      { bold: true },
      { fg: palette(1), bold: true },
      { bold: true, href: "https://example.com" },
    ]);
    expect([...(parse.lines[0]?.runs ?? [])]).toEqual([0, 1, 1, 2, 2, 1, 3, 3]);
  });

  it("resets with ESC[m and ESC[;31m", () => {
    const parse = parseAnsi("\x1b[1ma\x1b[mb\x1b[4m\x1b[;31mc");
    expect(parse.styles).toEqual([{}, { bold: true }, { fg: palette(1) }]);
    expect([...(parse.lines[0]?.runs ?? [])]).toEqual([0, 1, 1, 0, 2, 2]);
  });
});
