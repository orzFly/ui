import { describe, expect, it } from "vitest";

import {
  compileQuery,
  createMatchSink,
  MATCH_CAP,
  type MatchSink,
  scanLines,
} from "../../src/view/search.ts";

const plain = { caseSensitive: false, regex: false };

function lines(...texts: string[]) {
  return texts.map((text) => ({ text }));
}

function triples(sink: MatchSink): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < sink.count; i++) {
    out.push(Array.from(sink.matches.subarray(3 * i, 3 * i + 3)));
  }
  return out;
}

function scanAll(
  query: string,
  texts: string[],
  flags = plain,
  ids: Uint32Array | null = null,
): MatchSink {
  const re = compileQuery(query, flags);
  if (!(re instanceof RegExp)) throw new Error(`no pattern for ${query}`);
  const sink = createMatchSink();
  scanLines(re, lines(...texts), ids, 0, ids ? ids.length : texts.length, sink);
  return sink;
}

describe("compileQuery", () => {
  it("returns null for an empty query", () => {
    expect(compileQuery("", plain)).toBeNull();
    expect(compileQuery("", { caseSensitive: true, regex: true })).toBeNull();
  });

  it("escapes plain text, including characters `u` mode refuses to escape", () => {
    const re = compileQuery("a.b*(c)[d]{1}|e+f?^$\\/g-h", plain);
    expect(re).toBeInstanceOf(RegExp);
    const text = "x a.b*(c)[d]{1}|e+f?^$\\/g-h y";
    expect((re as RegExp).exec(text)?.index).toBe(2);
    expect((re as RegExp).test("aXb")).toBe(false);
  });

  it("sets g and u, and i unless case-sensitive", () => {
    expect((compileQuery("x", plain) as RegExp).flags).toBe("giu");
    expect(
      (compileQuery("x", { caseSensitive: true, regex: false }) as RegExp)
        .flags,
    ).toBe("gu");
  });

  it("takes a regular expression as written", () => {
    const re = compileQuery("err(or)?\\b", {
      caseSensitive: true,
      regex: true,
    });
    expect((re as RegExp).source).toBe("err(or)?\\b");
  });

  it("reports an invalid regular expression", () => {
    expect(compileQuery("(", { caseSensitive: false, regex: true })).toBe(
      "invalid",
    );
    expect(compileQuery("\\-", { caseSensitive: false, regex: true })).toBe(
      "invalid",
    );
    expect(compileQuery("(", plain)).toBeInstanceOf(RegExp);
  });
});

describe("scanLines", () => {
  const log = [
    "INFO connected to db.example",
    "error: timeout on app.example",
    "",
    "Error again, ERROR twice",
  ];

  it("finds every match, ignoring case by default", () => {
    const sink = scanAll("error", log);
    expect(triples(sink)).toEqual([
      [1, 0, 5],
      [3, 0, 5],
      [3, 13, 18],
    ]);
    expect(Array.from(sink.matchLines.subarray(0, 4))).toEqual([0, 1, 0, 1]);
    expect(sink.capped).toBe(false);
  });

  it("matches case when asked", () => {
    const sink = scanAll("ERROR", log, { caseSensitive: true, regex: false });
    expect(triples(sink)).toEqual([[3, 13, 18]]);
  });

  it("matches a regular expression", () => {
    const sink = scanAll("\\w+\\.example", log, {
      caseSensitive: false,
      regex: true,
    });
    expect(triples(sink)).toEqual([
      [0, 18, 28],
      [1, 18, 29],
    ]);
  });

  it("skips zero-length matches without looping", () => {
    const regex = { caseSensitive: false, regex: true };
    expect(scanAll("x*", ["axxb", "", "x"], regex).count).toBe(2);
    expect(triples(scanAll("x*", ["axxb", "", "x"], regex))).toEqual([
      [0, 1, 3],
      [2, 0, 1],
    ]);
    expect(scanAll("^", log, regex).count).toBe(0);
    // A lookahead before a surrogate pair must step over both halves.
    expect(triples(scanAll("(?=\u{1F600})|b", ["a\u{1F600}b"], regex))).toEqual(
      [[0, 3, 4]],
    );
  });

  it("scans only the listed ids", () => {
    const sink = scanAll("error", log, plain, Uint32Array.of(0, 3));
    expect(triples(sink)).toEqual([
      [3, 0, 5],
      [3, 13, 18],
    ]);
    expect(sink.matchLines[1]).toBe(0);
    expect(sink.matchLines.length).toBeGreaterThanOrEqual(4);
  });

  it("stores at most MATCH_CAP matches, then marks the sink capped", () => {
    const row = "a".repeat(1000);
    const texts = Array.from({ length: MATCH_CAP / 1000 }, () => row);
    const exact = scanAll("a", texts);
    expect(exact.count).toBe(MATCH_CAP);
    expect(exact.capped).toBe(false);

    const over = scanAll("a", [...texts, "a"]);
    expect(over.count).toBe(MATCH_CAP);
    expect(over.capped).toBe(true);
    expect(over.matchLines[texts.length]).toBe(0);

    const re = compileQuery("a", plain) as RegExp;
    scanLines(re, lines("a"), null, 0, 1, over);
    expect(over.count).toBe(MATCH_CAP);
  });

  it("gives the same matches scanned in slices as in one go", () => {
    const texts = Array.from(
      { length: 300 },
      (_, i) =>
        `${i % 3 === 0 ? "WARN" : "info"} host-one req ${i} warn=${i % 5}`,
    );
    const ids = Uint32Array.from(
      texts.map((_, i) => i).filter((i) => i % 4 !== 1),
    );
    for (const list of [null, ids]) {
      const n = list ? list.length : texts.length;
      const whole = scanAll("warn", texts, plain, list);
      const re = compileQuery("warn", plain) as RegExp;
      for (const size of [1, 7, 64]) {
        const sliced = createMatchSink();
        for (let from = 0; from < n; from += size) {
          scanLines(
            re,
            lines(...texts),
            list,
            from,
            Math.min(n, from + size),
            sliced,
          );
        }
        expect(triples(sliced)).toEqual(triples(whole));
        expect(sliced.matchLines.subarray(0, texts.length)).toEqual(
          whole.matchLines.subarray(0, texts.length),
        );
      }
    }
  });
});
