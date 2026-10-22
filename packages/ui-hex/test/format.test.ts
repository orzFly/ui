import { describe, expect, it } from "vitest";

import {
  addressDigits,
  asciiDecoding,
  copyText,
  formatAddress,
  formatSize,
  hexByte,
  MAX_COPY_BYTES,
} from "../src/format.ts";

describe("hexByte", () => {
  it("pads and follows the case", () => {
    expect(hexByte(0x0a)).toBe("0A");
    expect(hexByte(0xff, false)).toBe("ff");
    expect(hexByte(0)).toBe("00");
  });
});

describe("asciiDecoding", () => {
  const decode = (bytes: number[], mode: "abbreviations" | "dots") =>
    asciiDecoding.decodeRow(new Uint8Array(bytes), 0, mode);

  it("names control codes by position", () => {
    expect(
      decode([0x00, 0x0a, 0x0d, 0x1b, 0x1f, 0x7f], "abbreviations"),
    ).toEqual([
      { kind: "control", text: "NU" },
      { kind: "control", text: "LF" },
      { kind: "control", text: "CR" },
      { kind: "control", text: "EC" },
      { kind: "control", text: "US" },
      { kind: "control", text: "DT" },
    ]);
  });

  it("shows printable ASCII as itself and high bytes as dots", () => {
    expect(decode([0x20, 0x41, 0x7e, 0x80, 0xff], "abbreviations")).toEqual([
      { kind: "char", text: " " },
      { kind: "char", text: "A" },
      { kind: "char", text: "~" },
      { kind: "dot" },
      { kind: "dot" },
    ]);
  });

  it("renders control codes as dots in dots mode", () => {
    expect(decode([0x00, 0x7f, 0x41], "dots")).toEqual([
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

  it("caps copies at 1 MiB", () => {
    expect(MAX_COPY_BYTES).toBe(1024 * 1024);
  });
});
