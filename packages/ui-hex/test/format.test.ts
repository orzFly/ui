import { describe, expect, it } from "vitest";

import {
  addressDigits,
  copyRange,
  copyText,
  formatAddress,
  formatSize,
  hexByte,
  MAX_COPY_BYTES,
} from "../src/format.ts";
import { asciiDecoding } from "../src/text-decoding.ts";

describe("hexByte", () => {
  it("pads and follows the case", () => {
    expect(hexByte(0x0a)).toBe("0A");
    expect(hexByte(0xff, false)).toBe("ff");
    expect(hexByte(0)).toBe("00");
  });
});

describe("asciiDecoding", () => {
  const decode = (bytes: number[], mode: "abbreviations" | "dots") =>
    asciiDecoding.decodeRow(
      new Uint8Array(bytes),
      { start: 0, before: 0, length: bytes.length },
      mode,
    );

  it("names control codes by position", () => {
    expect(
      decode([0x00, 0x0a, 0x0d, 0x1b, 0x1f, 0x7f], "abbreviations"),
    ).toMatchObject([
      { kind: "control", text: "NU" },
      { kind: "control", text: "LF" },
      { kind: "control", text: "CR" },
      { kind: "control", text: "EC" },
      { kind: "control", text: "US" },
      { kind: "control", text: "DT" },
    ]);
  });

  it("shows printable ASCII as itself and high bytes as dots", () => {
    expect(
      decode([0x20, 0x41, 0x7e, 0x80, 0xff], "abbreviations"),
    ).toMatchObject([
      { kind: "char", text: " " },
      { kind: "char", text: "A" },
      { kind: "char", text: "~" },
      { kind: "dot" },
      { kind: "dot" },
    ]);
  });

  it("renders control codes as dots in dots mode", () => {
    expect(decode([0x00, 0x7f, 0x41], "dots")).toMatchObject([
      { kind: "dot" },
      { kind: "dot" },
      { kind: "char", text: "A" },
    ]);
  });

  it("has no lookbehind", () => {
    expect(asciiDecoding.lookbehind).toBe(0);
  });
});

describe("addresses and sizes", () => {
  it("uses at least four address digits", () => {
    expect(addressDigits(0)).toBe(4);
    expect(addressDigits(0xfff0)).toBe(4);
    expect(addressDigits(0x10000)).toBe(5);
    expect(addressDigits(0xfffffff0)).toBe(8);
  });

  it("pads addresses", () => {
    expect(formatAddress(0x30, 4)).toBe("0030");
    expect(formatAddress(0xab, 4, false)).toBe("00ab");
  });

  it("formats sizes in binary units", () => {
    expect(formatSize(0)).toBe("0 bytes (0x0)");
    expect(formatSize(1)).toBe("1 byte (0x1)");
    expect(formatSize(1023)).toBe("1023 bytes (0x3FF)");
    expect(formatSize(1024)).toBe("1 KB (0x400)");
    expect(formatSize(2377)).toBe("2.32 KB (0x949)");
    expect(formatSize(4 * 1024 ** 3)).toBe("4 GB (0x100000000)");
  });
});

describe("copyText", () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  it("joins hex pairs with spaces in the view's case", () => {
    expect(copyText(bytes, "hex")).toBe("89 50 4E 47 0D 0A");
    expect(copyText(bytes, "hex", false)).toBe("89 50 4e 47 0d 0a");
  });

  it("writes printable ASCII and dots for the rest", () => {
    expect(copyText(bytes, "text")).toBe(".PNG..");
  });

  it("decodes the text pane's form in the given encoding", () => {
    // "日本" in Shift_JIS, then "é" in Windows-1252.
    expect(
      copyText(
        new Uint8Array([0x93, 0xfa, 0x96, 0x7b]),
        "text",
        true,
        "shift_jis",
      ),
    ).toBe("日本");
    expect(copyText(new Uint8Array([0xe9]), "text", true, "windows-1252")).toBe(
      "é",
    );
    expect(copyText(new Uint8Array([0xe9]), "text")).toBe(".");
  });

  it("writes edge glyphs as the view shows them, given copyRange's bytes", () => {
    // "aé€" in UTF-8; the selection is A9 E2 82: the tail of "é", then "€".
    const utf8 = new Uint8Array([0x61, 0xc3, 0xa9, 0xe2, 0x82, 0xac]);
    const { from, to } = copyRange(2, 3, utf8.length, "utf-8");
    expect([from, to]).toEqual([0, 6]);
    expect(
      copyText(utf8.subarray(from, to), "text", true, "utf-8", 2 - from, 2, 3),
    ).toBe("€");
    expect(
      copyText(utf8.subarray(from, to), "hex", true, "utf-8", 2 - from, 2, 3),
    ).toBe("A9 E2 82");
  });

  it("widens the range only as far as the encoding and the source allow", () => {
    expect(copyRange(2, 3, 6)).toEqual({ from: 2, to: 5 });
    expect(copyRange(4, 2, 6, "utf-8")).toEqual({ from: 1, to: 6 });
    expect(copyRange(70, 2, 100, "shift_jis")).toEqual({ from: 6, to: 73 });
  });

  it("caps copies at 1 MiB", () => {
    expect(MAX_COPY_BYTES).toBe(1024 * 1024);
  });
});
