import { describe, expect, it } from "vitest";

import { parseHexText } from "../src/hex-paste.ts";

const PNG = [0x89, 0x50, 0x4e, 0x47];

describe("parseHexText", () => {
  it.each([
    "89 50 4E 47",
    "0x89, 0x50, 0x4e, 0x47",
    "{ 0x89, 0x50, 0x4E, 0x47 }",
    "[0x89;0x50;0x4e;0x47]",
    "\\x89\\x50\\x4e\\x47",
    "89504e47",
    "89 50\n4E 47\r\n",
    "\t8950 4E47 ",
    "0X89 0X50 0X4E 0X47",
  ])("parses %j", (text) => {
    expect([...(parseHexText(text) ?? [])]).toEqual(PNG);
  });

  it("accepts mixed case", () => {
    expect([...(parseHexText("aB cD") ?? [])]).toEqual([0xab, 0xcd]);
  });

  it("rejects an odd number of digits", () => {
    expect(parseHexText("89 5")).toBeNull();
  });

  it.each(["0xZZ", "89 G0", "hello", "89-50"])("rejects %j", (text) => {
    expect(parseHexText(text)).toBeNull();
  });

  it.each(["", "  \n "])("returns no bytes for %j", (text) => {
    expect(parseHexText(text)?.length).toBe(0);
  });
});
