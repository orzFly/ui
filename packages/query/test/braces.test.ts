import { describe, expect, it } from "vitest";
import { expandBraces } from "../src/braces.ts";
import { shellWords } from "../src/shell-words.ts";

function words(input: string): string[] {
  const result = expandBraces(input);
  if (!result.ok) throw new Error(result.reason);
  return result.words;
}

function wordsOfShell(input: string): string[] {
  const [word] = shellWords(input);
  if (word === undefined) throw new Error("no word");
  const result = expandBraces(word);
  if (!result.ok) throw new Error(result.reason);
  return result.words;
}

describe("expandBraces", () => {
  it("expands a comma group", () => {
    expect(words("{a,b}")).toEqual(["a", "b"]);
    expect(words("{a,b,c}")).toEqual(["a", "b", "c"]);
  });

  it("distributes adjacent text", () => {
    expect(words("x{a,b}y")).toEqual(["xay", "xby"]);
    expect(words("area:{web,ui}")).toEqual(["area:web", "area:ui"]);
  });

  it("multiplies groups left to right, in bash's order", () => {
    expect(words("{a,b}{,d,e}")).toEqual(["a", "ad", "ae", "b", "bd", "be"]);
  });

  it("keeps empty alternatives", () => {
    expect(words("x{,y}")).toEqual(["x", "xy"]);
  });

  it("nests groups", () => {
    expect(words("{a,b{c,d}}")).toEqual(["a", "bc", "bd"]);
    expect(words("{a,{b,c}d}e")).toEqual(["ae", "bde", "cde"]);
  });

  it("leaves text without a group unchanged", () => {
    expect(words("plain")).toEqual(["plain"]);
    expect(words("")).toEqual([""]);
    expect(words("{}")).toEqual(["{}"]);
    expect(words("{a}")).toEqual(["{a}"]);
    expect(words("{a,b")).toEqual(["{a,b"]);
    expect(words("a,b}")).toEqual(["a,b}"]);
    expect(words("{a},b}")).toEqual(["{a},b}"]);
  });

  it("expands a group inside literal braces", () => {
    expect(words("{x{a,b}}")).toEqual(["{xa}", "{xb}"]);
    expect(words("{{a,b}")).toEqual(["{a", "{b"]);
    expect(words("{a,{b}}")).toEqual(["a", "{b}"]);
  });

  it("leaves sequence expressions literal", () => {
    expect(words("{1..5}")).toEqual(["{1..5}"]);
    expect(words("{a..e}")).toEqual(["{a..e}"]);
  });

  it("treats quoted braces and commas as literal", () => {
    expect(wordsOfShell("'{a,b}'")).toEqual(["{a,b}"]);
    expect(wordsOfShell(`"{a,b}"`)).toEqual(["{a,b}"]);
    expect(wordsOfShell("{a','b,c}")).toEqual(["a,b", "c"]);
    expect(wordsOfShell(`{"In Progress",Done}`)).toEqual([
      "In Progress",
      "Done",
    ]);
  });

  it("treats escaped braces and commas as literal", () => {
    expect(wordsOfShell("\\{a,b\\}")).toEqual(["{a,b}"]);
    expect(wordsOfShell("{a\\,b,c}")).toEqual(["a,b", "c"]);
    expect(wordsOfShell("\\{a,b}")).toEqual(["{a,b}"]);
    expect(wordsOfShell("{a,b\\}")).toEqual(["{a,b}"]);
  });

  it("reads a plain string as entirely unquoted", () => {
    expect(words("'{a,b}'")).toEqual(["'a'", "'b'"]);
  });

  it("allows 64 words and fails with a reason past that", () => {
    const sixtyFour = "{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}";
    const result = expandBraces(sixtyFour);
    expect(result.ok && result.words.length).toBe(64);

    const sixtyFive = `{${Array.from({ length: 65 }, (_, i) => i).join(",")}}`;
    expect(expandBraces(sixtyFive)).toEqual({
      ok: false,
      reason: "expands to more than 64 values",
    });
    expect(expandBraces(`${sixtyFour}{a,b}`)).toMatchObject({ ok: false });
  });

  it("fails fast instead of building a huge product", () => {
    const huge = "{a,b,c,d,e,f,g,h}".repeat(20);
    expect(expandBraces(huge)).toMatchObject({ ok: false });
  });

  it("takes a custom limit", () => {
    expect(expandBraces("{a,b,c}", { limit: 2 })).toEqual({
      ok: false,
      reason: "expands to more than 2 values",
    });
    expect(expandBraces("{a,b}", { limit: 2 })).toEqual({
      ok: true,
      words: ["a", "b"],
    });
  });
});
