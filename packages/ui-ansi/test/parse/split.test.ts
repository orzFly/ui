import { describe, expect, it } from "vitest";

import {
  type AnsiParse,
  createAnsiParser,
  parseAnsi,
} from "../../src/parse/index.ts";

const E = "\x1b";

const FIXTURES: Record<string, string> = {
  plain: "line one\nline two\r\n\nlast line without newline",
  colours: `${E}[1;31merror${E}[0m: ${E}[38;5;208mwarn${E}[39m ${E}[38;2;10;20;30mrgb${E}[48:2::1:2:3m bg ${E}[4:3;58:5:196mcurly${E}[m\n${E}[;7minverse${E}[27m ${E}[2;3;9;53mmixed${E}[22;23;29;55m end\n`,
  malformed: `${E}[38;5mA${E}[38;5;300mB${E}[38;2;1;2mC${E}[48:5mD${E}[38;5;1mE${E}[0m`,
  progress: `Downloading\n${[0, 2, 5, 8, 10]
    .map(
      (n) => `${E}[32m${"█".repeat(n)}${E}[0m${"░".repeat(10 - n)} ${n * 10}%`,
    )
    .join("\r")}\r\ndone\n`,
  cursor: `abc\bX\t|\n12345678\tx${E}[3Cy${E}[2Dz${E}[5Gw${E}[20G!\nabcdef\r${E}[2C${E}[K|\nabcdef${E}[3G${E}[1K|${E}[2K${E}[Gnew\n`,
  wide: `中文 テスト 한국어 Ａ\u3000x\n\u{1f600}\u{1f469}\u200d\u{1f4bb} e\u0301 ❤\ufe0f\n中文中文\r${E}[Cx${E}[2Cy\n\u0301ab\r\u0301X\n`,
  links: `${E}]8;;https://example.com${E}\\link${E}]8;;${E}\\ ${E}]8;id=1;mailto:noreply@example.com\x07mail${E}[1m bold${E}[0m still\nnext line${E}]8;;\x07 ${E}]8;;javascript:alert(1)${E}\\nope${E}]8;;${E}\\\n`,
  dropped: `a${E}[2Jb${E}[?25lc${E}[>0cd${E}]0;title\x07e${E}Pq#0${E}\\f${E}(Bg${E}7h\x00i\x7fj\x85k\x9b31ml${E}_apc${E}\\m${E}[31\x18n${E}[3\n1mo${E}[1 qp${E}\ne${E}${E}[32mf`,
  longOsc: `before${E}]8;;https://example.com/${"x".repeat(4080)}\nafter ${E}[31mred`,
  fullOsc: `a${E}[31m${E}]0;${"y".repeat(4094)}\x07tail`,
  longDcs: `a${E}P${"z".repeat(4097)}end`,
  longCsi: `a${E}[${"1;".repeat(140)}31mb${E}[${"0;".repeat(126)}32mc`,
  unterminatedEnd: `text ${E}[31mred${E}]8;;https://example.com${E}\\x${E}[38;5`,
  lonelyEsc: `${E}`,
  trailingHigh: "a\ud83d",
};

function snapshot(parse: AnsiParse): string {
  return JSON.stringify({
    lines: parse.lines.map((l) => [l.text, [...l.runs], l.cells]),
    styles: parse.styles,
    maxCells: parse.maxCells,
  });
}

function feed(chunks: string[]): string {
  const parser = createAnsiParser();
  for (const chunk of chunks) parser.push(chunk);
  parser.end();
  return snapshot(parser);
}

describe("split invariance", () => {
  for (const [name, text] of Object.entries(FIXTURES)) {
    it(`${name}: two parts at every split point equal the whole`, () => {
      const whole = snapshot(parseAnsi(text));
      for (let i = 0; i <= text.length; i++) {
        const split = feed([text.slice(0, i), text.slice(i)]);
        if (split !== whole)
          expect({ at: i, split }).toEqual({ at: i, split: whole });
      }
    });

    it(`${name}: one code unit at a time equals the whole`, () => {
      expect(feed([...text.split("")])).toBe(snapshot(parseAnsi(text)));
    });
  }

  it("random chunkings of all fixtures together equal the whole", () => {
    const text = Object.values(FIXTURES).join("\n");
    const whole = snapshot(parseAnsi(text));
    let seed = 1;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 50; round++) {
      const chunks: string[] = [];
      let at = 0;
      while (at < text.length) {
        const size = 1 + Math.floor(random() * 40);
        chunks.push(text.slice(at, at + size));
        at += size;
      }
      expect(feed(chunks)).toBe(whole);
    }
  });

  it("random streams of every kind of token, split at every point, equal the whole", () => {
    const tokens = [
      "a",
      "中",
      "\u0301",
      "\u{1f600}",
      "\ud83d",
      "\ude00",
      "\t",
      "\b",
      "\r",
      "\n",
      "\r\n",
      `${E}[3C`,
      `${E}[2D`,
      `${E}[5G`,
      `${E}[K`,
      `${E}[1K`,
      `${E}[2K`,
      `${E}[31m`,
      `${E}[0m`,
      `${E}[?25l`,
      `${E}]8;;https://app.example${E}\\`,
      `${E}]8;;\x07`,
      `${E}]0;t`,
      `${E}P`,
      `${E}\\`,
      `${E}[`,
      E,
      "\x07",
      "\x00",
      "\u0085",
    ];
    let seed = 11;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 1500; round++) {
      let text = "";
      const n = Math.floor(random() * 16);
      for (let j = 0; j < n; j++)
        text += tokens[Math.floor(random() * tokens.length)];
      const whole = snapshot(parseAnsi(text));
      for (let i = 0; i <= text.length; i++) {
        const split = feed([text.slice(0, i), text.slice(i)]);
        if (split !== whole)
          expect({ text, at: i, split }).toEqual({ text, at: i, split: whole });
      }
    }
  });

  it("joins a surrogate pair and a CRLF cut across pushes", () => {
    expect(feed(["a\ud83d", "\ude00b"])).toBe(
      snapshot(parseAnsi("a\u{1f600}b")),
    );
    expect(parseAnsi("a\u{1f600}b").lines[0]?.cells).toBe(4);
    expect(feed(["ab\ud83d", "", "\ude00\r", "", "\nc"])).toBe(
      snapshot(parseAnsi("ab\u{1f600}\r\nc")),
    );
    expect(feed(["abc\r", "\n"])).toBe(snapshot(parseAnsi("abc\n")));
    expect(feed(["abc\r", "x"])).toBe(snapshot(parseAnsi("xbc")));
  });

  it("empty pushes change nothing", () => {
    const text = FIXTURES.colours as string;
    expect(feed(["", text.slice(0, 10), "", "", text.slice(10), ""])).toBe(
      snapshot(parseAnsi(text)),
    );
  });
});

describe("the fixtures parse as expected", () => {
  it("longOsc releases the OSC and reads on", () => {
    const { lines } = parseAnsi(FIXTURES.longOsc as string);
    expect(lines.map((l) => l.text)).toEqual([
      `before${"x".repeat(7)}`,
      "after red",
    ]);
  });

  it("an OSC of exactly 4 KiB is still dropped whole", () => {
    expect(parseAnsi(FIXTURES.fullOsc as string).lines[0]?.text).toBe("atail");
  });

  it("longDcs releases the string after 4 KiB", () => {
    expect(parseAnsi(FIXTURES.longDcs as string).lines[0]?.text).toBe("azend");
  });

  it("unterminatedEnd drops the cut escape", () => {
    expect(parseAnsi(FIXTURES.unterminatedEnd as string).lines[0]?.text).toBe(
      "text redx",
    );
  });
});

describe("performance", () => {
  it("parses 3 MiB of plain log quickly", () => {
    const line =
      "2026-01-01T00:00:00Z INFO server: request handled in 12ms path=/api/items status=200\n";
    const text = line.repeat(Math.ceil((3 << 20) / line.length));
    const start = performance.now();
    const parse = parseAnsi(text);
    const elapsed = performance.now() - start;
    expect(parse.lines.length).toBe(text.split("\n").length);
    expect(elapsed).toBeLessThan(2000);
  });

  it("parses 3 MiB of coloured log with progress bars quickly", () => {
    const line = `\x1b[32mINFO\x1b[0m step \x1b[1m42\x1b[22m 中文 ok\r\x1b[2Kdone \x1b[38;5;208m100%\x1b[m\n`;
    const text = line.repeat(Math.ceil((3 << 20) / line.length));
    const start = performance.now();
    parseAnsi(text);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
