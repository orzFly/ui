import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../src/parse/index.ts";

const link = (uri: string, st = "\x1b\\") => `\x1b]8;;${uri}${st}`;

/** Each run of the first line as `[text, href]`. */
function hrefs(input: string): [string, string | undefined][] {
  const { lines, styles } = parseAnsi(input);
  const line = lines[0];
  if (!line) throw new Error("no line");
  const out: [string, string | undefined][] = [];
  for (let i = 0; i < line.runs.length; i += 2) {
    const to = i + 2 < line.runs.length ? line.runs[i + 2] : line.text.length;
    out.push([
      line.text.slice(line.runs[i], to),
      styles[line.runs[i + 1] as number]?.href,
    ]);
  }
  return out;
}

describe("OSC 8 links", () => {
  it("opens and closes with ESC \\", () => {
    expect(hrefs(`a${link("https://example.com")}b${link("")}c`)).toEqual([
      ["a", undefined],
      ["b", "https://example.com"],
      ["c", undefined],
    ]);
  });

  it("opens and closes with BEL", () => {
    expect(
      hrefs(`a${link("http://example.com/x", "\x07")}b${link("", "\x07")}c`),
    ).toEqual([
      ["a", undefined],
      ["b", "http://example.com/x"],
      ["c", undefined],
    ]);
  });

  it("ignores the link parameters", () => {
    expect(hrefs("\x1b]8;id=1:x=y;mailto:noreply@example.com\x07m")).toEqual([
      ["m", "mailto:noreply@example.com"],
    ]);
  });

  it("allows only http, https and mailto", () => {
    for (const uri of [
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "ftp://example.com",
      "example.com",
    ]) {
      expect(hrefs(`${link(uri)}text`)).toEqual([["text", undefined]]);
    }
    expect(hrefs(`${link("HTTPS://example.com")}x`)).toEqual([
      ["x", "HTTPS://example.com"],
    ]);
  });

  it("a refused link ends the one before it", () => {
    expect(
      hrefs(`${link("https://example.com")}a${link("javascript:x")}b`),
    ).toEqual([
      ["a", "https://example.com"],
      ["b", undefined],
    ]);
  });

  it("drops a URI over 2,048 characters", () => {
    const at = (n: number) => `https://example.com/${"a".repeat(n - 20)}`;
    expect(at(2048)).toHaveLength(2048);
    expect(hrefs(`${link(at(2048))}x`)).toEqual([["x", at(2048)]]);
    expect(hrefs(`${link(at(2049))}x`)).toEqual([["x", undefined]]);
  });

  it("stays open across an SGR reset and a newline", () => {
    const { lines, styles } = parseAnsi(
      `${link("https://example.com")}\x1b[1ma\x1b[0mb\nc${link("")}d`,
    );
    expect(styles).toEqual([
      {},
      { bold: true, href: "https://example.com" },
      { href: "https://example.com" },
    ]);
    expect([...(lines[0]?.runs ?? [])]).toEqual([0, 1, 1, 2]);
    expect([...(lines[1]?.runs ?? [])]).toEqual([0, 2, 1, 0]);
  });

  it("ignores an OSC 8 without its second separator", () => {
    expect(hrefs("\x1b]8;https://example.com\x07x")).toEqual([
      ["x", undefined],
    ]);
  });
});
