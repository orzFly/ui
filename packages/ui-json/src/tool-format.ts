// Ported from PicoTera (BSD-3-Clause); see NOTICE.
// One-line, Python-literal-style rendering of tool calls and tool results:
// `Bash(command="ls -la")`, `Bash → "total 8\n…"`. Pure functions over arbitrary
// JSON values, with no Vue or `@/` dependency, so any view can reuse them.

export const TOOL_ARG_MAX_CHARS = 128;

export type ToolToken =
  | { kind: "name"; text: string }
  | { kind: "key"; text: string }
  | { kind: "value"; text: string }
  | { kind: "punct"; text: string };

export type ToolResultSegment =
  | { kind: "text"; text: string }
  | { kind: "block"; block: Record<string, unknown> };

const ELLIPSIS = "…";
const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u;

function escapeChar(ch: string): string {
  switch (ch) {
    case "\\":
      return "\\\\";
    case '"':
      return '\\"';
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
  }
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x20 || code === 0x7f)
    return `\\x${code.toString(16).padStart(2, "0")}`;
  return ch;
}

// A string's budget counts source code points, not the escaped output.
function formatString(text: string, maxChars: number): string {
  let out = '"';
  let count = 0;
  let truncated = false;
  for (const ch of text) {
    if (count >= maxChars) {
      truncated = true;
      break;
    }
    out += escapeChar(ch);
    count++;
  }
  return `${out}${truncated ? ELLIPSIS : ""}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Collects output text while counting code points, and reports `full` once the
// count passes the limit so a large array / object stops being walked early.
class BudgetWriter {
  private chunks: string[] = [];
  private count = 0;

  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  get full(): boolean {
    return this.count > this.limit;
  }

  push(text: string) {
    this.chunks.push(text);
    // Code points = UTF-16 units minus the trailing half of each surrogate pair.
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      if (unit < 0xdc00 || unit > 0xdfff) this.count++;
    }
  }

  pushString(text: string) {
    this.push('"');
    for (const ch of text) {
      if (this.full) return;
      this.push(escapeChar(ch));
    }
    this.push('"');
  }

  finish(): string {
    const text = this.chunks.join("");
    if (!this.full) return text;
    let out = "";
    let count = 0;
    for (const ch of text) {
      if (count >= this.limit) break;
      out += ch;
      count++;
    }
    return out + ELLIPSIS;
  }
}

function writeScalar(w: BudgetWriter, value: unknown) {
  if (typeof value === "string") w.pushString(value);
  else if (typeof value === "boolean") w.push(value ? "True" : "False");
  else if (value === null || value === undefined) w.push("None");
  else w.push(String(value));
}

function writeValue(w: BudgetWriter, value: unknown) {
  if (Array.isArray(value)) {
    w.push("[");
    for (const [index, item] of value.entries()) {
      if (w.full) return;
      if (index > 0) w.push(", ");
      writeValue(w, item);
    }
    w.push("]");
  } else if (isRecord(value)) {
    w.push("{");
    let first = true;
    for (const [key, item] of Object.entries(value)) {
      if (w.full) return;
      if (!first) w.push(", ");
      first = false;
      w.pushString(key);
      w.push(": ");
      writeValue(w, item);
    }
    w.push("}");
  } else {
    writeScalar(w, value);
  }
}

// Strings are cut at `maxChars` source characters with `…` before the closing
// quote; arrays / objects are cut at `maxChars` characters of output text.
export function formatToolValue(
  value: unknown,
  maxChars: number = TOOL_ARG_MAX_CHARS,
): string {
  if (typeof value === "string") return formatString(value, maxChars);
  const w = new BudgetWriter(maxChars);
  writeValue(w, value);
  return w.finish();
}

export function toolCallTokens(
  name: string,
  input: unknown,
  maxChars: number = TOOL_ARG_MAX_CHARS,
): ToolToken[] {
  const tokens: ToolToken[] = [
    { kind: "name", text: name },
    { kind: "punct", text: "(" },
  ];
  if (isRecord(input)) {
    let first = true;
    for (const [key, value] of Object.entries(input)) {
      if (!first) tokens.push({ kind: "punct", text: ", " });
      first = false;
      tokens.push({
        kind: "key",
        text: IDENTIFIER.test(key) ? key : formatToolValue(key, Infinity),
      });
      tokens.push({ kind: "punct", text: "=" });
      tokens.push({ kind: "value", text: formatToolValue(value, maxChars) });
    }
  } else if (input !== null && input !== undefined) {
    tokens.push({ kind: "value", text: formatToolValue(input, maxChars) });
  }
  tokens.push({ kind: "punct", text: ")" });
  return tokens;
}

function joinTokens(tokens: ToolToken[]): string {
  return tokens.map((token) => token.text).join("");
}

export function formatToolCall(
  name: string,
  input: unknown,
  maxChars: number = TOOL_ARG_MAX_CHARS,
): string {
  return joinTokens(toolCallTokens(name, input, maxChars));
}

// A tool result is either a bare string or an array of typed content blocks
// (Anthropic `tool_result.content`, Responses `function_call_output.output`);
// anything else has no segment structure and yields null.
export function toolResultSegments(
  output: unknown,
): ToolResultSegment[] | null {
  if (typeof output === "string") return [{ kind: "text", text: output }];
  if (!Array.isArray(output) || output.length === 0) return null;
  const segments: ToolResultSegment[] = [];
  for (const item of output) {
    if (!isRecord(item) || typeof item.type !== "string") return null;
    if (
      (item.type === "text" ||
        item.type === "input_text" ||
        item.type === "output_text") &&
      typeof item.text === "string"
    ) {
      segments.push({ kind: "text", text: item.text });
    } else {
      segments.push({ kind: "block", block: item });
    }
  }
  return segments;
}

export function toolResultTokens(
  name: string | null,
  output: unknown,
  maxChars: number = TOOL_ARG_MAX_CHARS,
): ToolToken[] {
  const segments = toolResultSegments(output);
  const value =
    segments === null
      ? formatToolValue(output, maxChars)
      : formatToolValue(
          segments
            .map((segment) =>
              segment.kind === "text"
                ? segment.text
                : `[${String(segment.block.type)}]`,
            )
            .join("\n"),
          maxChars,
        );
  const tokens: ToolToken[] = [];
  if (name === null) {
    tokens.push({ kind: "punct", text: "→ " });
  } else {
    tokens.push({ kind: "name", text: name });
    tokens.push({ kind: "punct", text: " → " });
  }
  tokens.push({ kind: "value", text: value });
  return tokens;
}

export function formatToolResult(
  name: string | null,
  output: unknown,
  maxChars: number = TOOL_ARG_MAX_CHARS,
): string {
  return joinTokens(toolResultTokens(name, output, maxChars));
}
