import { describe, expect, it } from "vitest";

import { stripAnsi } from "../../src/parse/index.ts";

describe("stripAnsi", () => {
  it("returns plain text unchanged", () => {
    for (const text of [
      "",
      "a",
      "a\n",
      "\n",
      "a\nb\n\nc",
      "中文 \u{1f600} é ",
    ]) {
      expect(stripAnsi(text)).toBe(text);
    }
  });

  it("removes escapes and applies cursor moves", () => {
    expect(
      stripAnsi(
        "\x1b[1;31merror\x1b[0m: \x1b]8;;https://example.com\x07link\x1b]8;;\x07\n50%\r100%\n",
      ),
    ).toBe("error: link\n100%\n");
  });

  it("normalises CRLF to \\n and expands tabs", () => {
    expect(stripAnsi("a\r\nb\tc")).toBe("a\nb       c");
  });
});
