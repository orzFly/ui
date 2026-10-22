import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ENCODING_TABLE,
  getTextDecoding,
  HEX_ENCODINGS,
  type HexEncoding,
  probeEncodings,
} from "../src/encodings.ts";
import { asciiDecoding } from "../src/text-decoding.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HEX_ENCODINGS", () => {
  it("has unique ids", () => {
    const ids = ENCODING_TABLE.map((info) => info.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists only encodings that construct", () => {
    for (const { id } of HEX_ENCODINGS) {
      if (id === "ascii" || id === "iso-8859-1") continue;
      expect(() => new TextDecoder(id, { fatal: true })).not.toThrow();
    }
  });

  it("keeps the groups in picker order", () => {
    const groups = HEX_ENCODINGS.map((info) => info.group).filter(
      (group, i, all) => all[i - 1] !== group,
    );
    expect(groups).toEqual(["Western", "Unicode", "East Asian", "Other"]);
  });

  it("drops what the runtime lacks", () => {
    const missing = new Set(["big5", "koi8-u"]);
    class FakeDecoder {
      constructor(label: string) {
        if (missing.has(label)) throw new RangeError(label);
      }
    }
    const ids = probeEncodings(FakeDecoder).map((info) => info.id);
    expect(ids).not.toContain("big5");
    expect(ids).not.toContain("koi8-u");
    expect(ids).toContain("ascii");
    expect(ids).toContain("iso-8859-1");
    expect(ids).toHaveLength(ENCODING_TABLE.length - 2);
  });

  it("matches Node's ICU on ISO-8859-16", () => {
    let constructs = true;
    try {
      new TextDecoder("iso-8859-16");
    } catch {
      constructs = false;
    }
    expect(HEX_ENCODINGS.some((info) => info.id === "iso-8859-16")).toBe(
      constructs,
    );
  });
});

describe("getTextDecoding", () => {
  it("falls back to ASCII with one warning per id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = "x-unknown" as HexEncoding;
    expect(getTextDecoding(id)).toBe(asciiDecoding);
    expect(getTextDecoding(id)).toBe(asciiDecoding);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back for an encoding left out of the probe", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const available = HEX_ENCODINGS.filter((info) => info.id !== "koi8-r");
    expect(getTextDecoding("koi8-r", available)).toBe(asciiDecoding);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("memoises each decoding", () => {
    expect(getTextDecoding("windows-1251")).toBe(
      getTextDecoding("windows-1251"),
    );
    expect(getTextDecoding("windows-1251")).not.toBe(asciiDecoding);
  });
});
