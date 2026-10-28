import { describe, expect, it } from "vitest";
import { CONFIG_FILES } from "../src/demos/config-editor/files.ts";
import { checkJson } from "../src/demos/config-editor/json-check.ts";

const at = (text: string) => {
  const problem = checkJson(text);
  return problem && `${problem.line}: ${problem.message}`;
};

describe("checkJson", () => {
  it("passes every sample file, and what JSON.parse takes", () => {
    for (const { contents } of CONFIG_FILES)
      expect(checkJson(contents)).toBe(null);
    for (const text of [
      '"a"',
      "-1.5e+3",
      "[]",
      "{}",
      '{"a":[true,false,null]}',
      '"\\u00e9\\n"',
    ]) {
      expect(JSON.parse(text)).toBeDefined();
      expect(checkJson(text)).toBe(null);
    }
  });

  it("names the first problem and its line", () => {
    expect(at('{\n  "retries": 2,\n  "timeout": "30s",,\n}')).toBe(
      '3: Unexpected ","',
    );
    expect(at('{\n  "a": 1,\n}')).toBe("2: Trailing comma");
    expect(at("[1, 2,]")).toBe("1: Trailing comma");
    expect(at('{\n  "a": 1\n  "b": 2\n}')).toBe('3: Expected "," or "}"');
    expect(at("{\n  retries: 2\n}")).toBe(
      "2: Property names need double quotes",
    );
    expect(at('{"a" 1}')).toBe('1: Expected ":" after the property name');
    expect(at('{"a": "open\n}')).toBe("1: Unterminated string");
    expect(at('"\\x"')).toBe("1: Invalid escape");
    expect(at('{"a": yes}')).toBe('1: Unexpected "yes"');
    expect(at("{} {}")).toBe('1: Unexpected "{" after the end');
    expect(at('{"a": [1')).toBe('1: Expected "," or "]"');
    expect(at("  \n")).toBe("2: The file is empty");
  });

  it("marks the offending text, and nothing past the end", () => {
    expect(checkJson("{\n  retries: 2\n}")).toMatchObject({ from: 4, to: 11 });
    const end = checkJson('{"a": ');
    expect(end).toMatchObject({ from: 6, to: 6 });
  });
});
