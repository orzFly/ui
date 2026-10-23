import { describe, expect, it } from "vitest";
import { scanCast } from "../src/cast.ts";

const lines = (...rows: unknown[]) =>
  rows.map((row) => JSON.stringify(row)).join("\n");

/** Times come out of float subtraction; compare them to the microsecond. */
function rounded(scan: ReturnType<typeof scanCast>) {
  if ("error" in scan) return scan;
  const round = (t: number) => Math.round(t * 1e6) / 1e6;
  return {
    ...scan,
    duration: round(scan.duration),
    markers: scan.markers.map((m) => ({ ...m, time: round(m.time) })),
  };
}

describe("scanCast", () => {
  it("reads a v1 cast: size, title, and the sum of its delays", () => {
    const v1 = JSON.stringify(
      {
        version: 1,
        width: 80,
        height: 24,
        title: "demo",
        stdout: [
          [0.5, "$ "],
          [1.25, "ls\r\n"],
          [40, "done\r\n"],
        ],
      },
      null,
      2,
    );
    expect(scanCast(v1)).toEqual({
      version: 1,
      cols: 80,
      rows: 24,
      title: "demo",
      duration: 41.75,
      markers: [],
    });
  });

  it("reads a v2 cast, capping idle gaps in the duration and the markers after them", () => {
    const v2 = lines(
      { version: 2, width: 100, height: 30, idle_time_limit: 2, title: "t" },
      [0.5, "o", "$ "],
      [1, "m", "start"],
      [1.5, "i", "x"],
      [1.6, "r", "90x30"],
      [1.7, "x", "0"],
      [31.7, "o", "late\r\n"],
      [32, "m", "tests"],
      [33, "m", ""],
    );
    expect(rounded(scanCast(v2))).toEqual({
      version: 2,
      cols: 100,
      rows: 30,
      title: "t",
      duration: 5,
      markers: [
        { time: 1, label: "start" },
        { time: 4, label: "tests" },
        { time: 5, label: "" },
      ],
    });
  });

  it("caps the gap before the first event, as the player does", () => {
    const v2 = lines(
      { version: 2, width: 80, height: 24, idle_time_limit: 1 },
      [10, "o", "x"],
    );
    expect(scanCast(v2)).toMatchObject({ duration: 1 });
  });

  it("leaves a v2 cast without idle_time_limit uncapped", () => {
    const v2 = lines(
      { version: 2, width: 80, height: 24 },
      [0.1, "o", "a"],
      [60.1, "o", "b"],
    );
    expect(scanCast(v2)).toMatchObject({ duration: 60.1, markers: [] });
  });

  it("reads a v3 cast: intervals accumulate, term sets the size, comments are skipped", () => {
    const v3 = [
      JSON.stringify({
        version: 3,
        term: { cols: 120, rows: 40, type: "xterm-256color" },
        idle_time_limit: 2,
      }),
      "# a comment",
      JSON.stringify([0.5, "o", "a"]),
      JSON.stringify([1, "m", "half"]),
      "#another",
      JSON.stringify([10, "o", "b"]),
      JSON.stringify([0.25, "m", "end"]),
    ].join("\n");
    const scan = rounded(scanCast(v3));
    expect(scan).toMatchObject({ version: 3, cols: 120, rows: 40 });
    expect(scan).not.toHaveProperty("title");
    expect(scan).toMatchObject({
      duration: 3.75,
      markers: [
        { time: 1.5, label: "half" },
        { time: 3.75, label: "end" },
      ],
    });
  });

  it("accepts CRLF line endings, a trailing newline and blank lines", () => {
    const v2 = `${lines({ version: 2, width: 80, height: 24 }, [
      1,
      "o",
      "a",
    ])}\r\n\r\n${JSON.stringify([2, "m", "x"])}\r\n`;
    expect(scanCast(v2)).toMatchObject({
      duration: 2,
      markers: [{ time: 2, label: "x" }],
    });
  });

  describe("errors", () => {
    it("empty text", () => {
      expect(scanCast("")).toEqual({ error: "Empty recording" });
      expect(scanCast("\n \n")).toEqual({ error: "Empty recording" });
    });

    it("a first line that is not JSON", () => {
      expect(scanCast('hello\n[1, "o", "x"]')).toEqual({
        error: "Line 1: not JSON",
      });
    });

    it("an unknown version", () => {
      expect(
        scanCast(lines({ version: 4, width: 80, height: 24 }, [1, "o", "x"])),
      ).toEqual({ error: "Line 1: unsupported asciicast version 4" });
    });

    it("a missing or non-positive size", () => {
      expect(
        scanCast(lines({ version: 2, width: 0, height: 24 }, [1, "o", "x"])),
      ).toEqual({ error: "Line 1: missing or invalid size" });
      expect(scanCast(lines({ version: 3, term: {} }, [1, "o", "x"]))).toEqual({
        error: "Line 1: missing or invalid size",
      });
    });

    it("a malformed event line, by its number", () => {
      const text = [
        JSON.stringify({ version: 2, width: 80, height: 24 }),
        JSON.stringify([1, "o", "x"]),
        "not json",
      ].join("\n");
      expect(scanCast(text)).toEqual({ error: "Line 3: not an event" });
      expect(
        scanCast(
          lines({ version: 2, width: 80, height: 24 }, { time: 1 }, [2, "o"]),
        ),
      ).toEqual({ error: "Line 2: not an event" });
    });

    it("a header with no events", () => {
      expect(scanCast(lines({ version: 2, width: 80, height: 24 }))).toEqual({
        error: "No events",
      });
    });
  });
});
