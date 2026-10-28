// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bytesSource } from "@orz/ui-hex";
import { describe, expect, it } from "vitest";
import {
  parseStructure,
  type Region,
  regionPath,
} from "../src/demos/binary-inspector/structure.ts";

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(
      join(import.meta.dirname, "../../fixtures/src/attachment", name),
    ),
  );

const parse = (bytes: Uint8Array) =>
  parseStructure(bytesSource(bytes), new AbortController().signal);

const outline = (regions: readonly Region[]) =>
  regions.map(({ label, offset, length }) => `${label} ${offset}+${length}`);

describe("binary structure", () => {
  it("lists a PNG's signature and chunks, and IHDR's fields", async () => {
    const structure = await parse(fixture("gradient.png"));
    expect(structure?.format).toBe("PNG image");
    expect(structure?.littleEndian).toBe(false);
    const regions = structure?.regions ?? [];
    expect(outline(regions)).toEqual([
      "Signature 0+8",
      "IHDR 8+25",
      "IDAT 33+1465",
      "IEND 1498+12",
    ]);
    const header = regions[1];
    expect(header?.value).toBe("320 × 200, 8-bit RGB");
    expect(header?.children?.map(({ label }) => label)).toEqual([
      "Length",
      "Type",
      "Width",
      "Height",
      "Bit depth",
      "Colour type",
      "Compression",
      "Filter",
      "Interlace",
      "CRC",
    ]);
  });

  it("lists a ZIP's files, central directory and end record", async () => {
    const structure = await parse(fixture("bundle.zip"));
    expect(structure?.format).toBe("ZIP archive");
    expect(structure?.littleEndian).toBe(true);
    const regions = structure?.regions ?? [];
    expect(outline(regions)).toEqual([
      "readme.txt 0+104",
      "Central directory 104+56",
      "End of directory 160+22",
    ]);
    expect(regions[0]?.value).toBe("stored, 64 bytes");
    expect(outline(regions[0]?.children ?? [])).toEqual([
      "Header 0+30",
      "Name 30+10",
      "Data 40+64",
    ]);
  });

  it("keeps what came before a chunk cut short", async () => {
    const png = fixture("gradient.png");
    const regions = (await parse(png.subarray(0, 100)))?.regions ?? [];
    expect(outline(regions)).toEqual([
      "Signature 0+8",
      "IHDR 8+25",
      "Truncated IDAT 33+67",
    ]);
  });

  it("has no structure for another format", async () => {
    expect(await parse(new TextEncoder().encode("plain text"))).toBeNull();
    expect(await parse(new Uint8Array())).toBeNull();
  });

  it("finds the innermost region that holds a whole selection", async () => {
    const regions = (await parse(fixture("gradient.png")))?.regions ?? [];
    const labels = (start: number, end: number) =>
      regionPath(regions, start, end).map(({ label }) => label);
    expect(labels(16, 16)).toEqual(["IHDR", "Width"]);
    expect(labels(8, 32)).toEqual(["IHDR"]);
    expect(labels(4, 12)).toEqual([]);
  });
});
