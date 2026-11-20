import { describe, expect, it } from "vitest";
import { agentTraceSummary } from "../src/summary.ts";

describe("agentTraceSummary", () => {
  it("reads an Anthropic tool_use block as a call", () => {
    expect(
      agentTraceSummary({
        type: "tool_use",
        id: "toolu_01",
        name: "Bash",
        input: { command: "ls -la" },
      }),
    ).toEqual({
      tags: [{ key: "type", text: "tool_use" }],
      name: "Bash",
      args: [
        { kind: "punct", text: "(" },
        { kind: "key", text: "command" },
        { kind: "punct", text: "=" },
        { kind: "value", text: '"ls -la"' },
        { kind: "punct", text: ")" },
      ],
      text: null,
    });
  });

  it("reads an OpenAI tool call's string arguments", () => {
    const summary = agentTraceSummary({
      role: "assistant",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "read", arguments: '{"path":"a.txt"}' },
        },
      ],
    });
    expect(summary?.tags).toEqual([
      { key: "role", text: "assistant", emphasis: true },
    ]);
    expect(summary?.name).toBe("read");
    expect(summary?.args?.map((token) => token.text).join("")).toBe(
      '(path="a.txt")',
    );
  });

  it("reads a Gemini functionCall", () => {
    const summary = agentTraceSummary({
      functionCall: { name: "search", args: { q: "x" } },
    });
    expect(summary?.name).toBe("search");
    expect(summary?.args?.map((token) => token.text).join("")).toBe('(q="x")');
  });

  it("reads a message's text, whitespace collapsed", () => {
    expect(
      agentTraceSummary({
        role: "user",
        content: [{ type: "text", text: "  List\n\n the   files " }],
      }),
    ).toEqual({
      tags: [{ key: "role", text: "user", emphasis: true }],
      name: null,
      args: null,
      text: "List the files ",
    });
  });

  it("drops a tag that repeats another", () => {
    expect(
      agentTraceSummary({ type: "message", role: "message", object: "x y" })
        ?.tags,
    ).toEqual([{ key: "type", text: "message" }]);
  });

  it("cuts a call's arguments at 128 characters", () => {
    const summary = agentTraceSummary({
      name: "Write",
      input: { content: "z".repeat(500) },
    });
    const text = summary?.args?.map((token) => token.text).join("") ?? "";
    expect(text.endsWith("…)")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(128 + 2);
  });

  it("finds nothing in an object of no known shape", () => {
    expect(agentTraceSummary({ a: 1, b: [2] })).toBeNull();
  });
});
