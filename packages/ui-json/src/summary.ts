// Ported from PicoTera (BSD-3-Clause); see NOTICE.
/**
 * One-line summaries for collapsed objects in `JsonView`, for agent traces.
 *
 * Agent traces are mostly messages, content blocks, tool declarations and SSE
 * events, and every LLM wire format spells those with the same handful of field
 * names — `type`, `role`, `name`, `text`, `content`, `parts`, `delta`. Matching
 * on field names alone therefore covers all of them without detecting a format
 * first. Every lookup is bounded, so summarising each row of a large listing
 * stays cheap however big the objects are.
 */

import { type ToolToken, toolCallTokens } from "./tool-format.ts";
import type { JsonSummary } from "./types.ts";

export type TagKey = (typeof TAG_KEYS)[number];

export interface SummaryTag {
  key: TagKey;
  text: string;
}

/** Longer values (or ones holding whitespace) are prose, not a kind label. */
export const TAG_MAX_CHARS = 32;
export const NAME_LIMIT = 40;
export const TEXT_LIMIT = 128;

const ELLIPSIS = "…";

const TAG_KEYS = ["type", "role", "object"] as const;

const NAME_PATHS: ReadonlyArray<readonly string[]> = [
  ["name"],
  ["function", "name"],
  ["functionCall", "name"],
  ["functionResponse", "name"],
];

/** Where the body — or the nested block carrying it — lives, most specific
 *  first. Followed again inside each nested object, so `delta.text`,
 *  `content[0].text` and `tool_calls[0].function` all resolve. */
const TEXT_KEYS = [
  "text",
  "content",
  "parts",
  "thinking",
  "summary",
  "delta",
  "output",
  "arguments",
  "description",
  "function",
  "tool_calls",
] as const;

/** Array elements looked at per level before giving up. */
const ARRAY_SCAN = 4;

/** Container levels `valueBlock` descends below a text field. */
const TEXT_DEPTH = 2;

/** Where a named object keeps its tool-call arguments as an object… */
const ARG_PATHS: ReadonlyArray<readonly string[]> = [
  ["input"],
  ["args"],
  ["functionCall", "args"],
];

/** …or as a JSON string (OpenAI Chat `tool_calls`, Responses `function_call`). */
const ARG_TEXT_PATHS: ReadonlyArray<readonly string[]> = [
  ["arguments"],
  ["function", "arguments"],
];

/** Longer argument strings stay unparsed and show as body text instead. */
const ARGS_PARSE_LIMIT = 8192;

/** Arguments handed to the formatter. 128 characters cannot show more than this
 *  many, and the formatter would otherwise walk every key. */
const ARGS_SCAN = 32;

const WHITESPACE_RE = /\s+/g;
const HAS_WHITESPACE_RE = /\s/;
const NON_WHITESPACE_RE = /\S/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Cut to `limit` UTF-16 units without splitting a surrogate pair. */
function cut(text: string, limit: number): string {
  let chunk = text.slice(0, limit);
  const last = chunk.charCodeAt(chunk.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) chunk = chunk.slice(0, -1);
  return chunk;
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${cut(text, limit)}${ELLIPSIS}` : text;
}

/** A display snippet from a bounded slice: collapsing whitespace over a
 *  multi-megabyte string just to show 128 characters would be pure waste. */
function snippet(text: string): string {
  const window = TEXT_LIMIT * 4;
  // Slice from the first visible character, so leading indentation cannot eat
  // the whole window. `valueBlock` only hands over strings that have one.
  const start = text.search(NON_WHITESPACE_RE);
  const collapsed = cut(text.slice(start, start + window), window).replace(
    WHITESPACE_RE,
    " ",
  );
  if (collapsed.length > TEXT_LIMIT || text.length > start + window) {
    return `${cut(collapsed, TEXT_LIMIT)}${ELLIPSIS}`;
  }
  return collapsed;
}

function tagsOf(record: Record<string, unknown>): SummaryTag[] {
  const tags: SummaryTag[] = [];
  for (const key of TAG_KEYS) {
    const value = record[key];
    if (
      typeof value !== "string" ||
      value === "" ||
      value.length > TAG_MAX_CHARS
    )
      continue;
    if (HAS_WHITESPACE_RE.test(value) || tags.some((tag) => tag.text === value))
      continue;
    tags.push({ key, text: value });
  }
  return tags;
}

function at(record: Record<string, unknown>, path: readonly string[]): unknown {
  let node: unknown = record;
  for (const key of path) node = isRecord(node) ? node[key] : undefined;
  return node;
}

function nameOf(record: Record<string, unknown>): string | null {
  for (const path of NAME_PATHS) {
    const node = at(record, path);
    if (typeof node === "string" && node !== "")
      return truncate(node, NAME_LIMIT);
  }
  return null;
}

function argsOf(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const path of ARG_PATHS) {
    const node = at(record, path);
    if (isRecord(node)) return node;
  }
  for (const path of ARG_TEXT_PATHS) {
    const node = at(record, path);
    if (typeof node !== "string" || node.length > ARGS_PARSE_LIMIT) continue;
    try {
      const parsed: unknown = JSON.parse(node);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Not JSON: the string still shows up as body text.
    }
  }
  return null;
}

/** `(key="value", …)` with the whole run, parentheses included, cut to `TEXT_LIMIT`. */
function argTokens(name: string, input: Record<string, unknown>): ToolToken[] {
  const head: Record<string, unknown> = {};
  let count = 0;
  for (const key in input) {
    if (count++ >= ARGS_SCAN) break;
    head[key] = input[key];
  }
  // Drop the name token: the row renders the name on its own.
  const tokens = toolCallTokens(name, head, TEXT_LIMIT).slice(1);
  const out: ToolToken[] = [];
  let used = 0;
  for (const token of tokens) {
    if (used + token.text.length > TEXT_LIMIT) {
      const room = TEXT_LIMIT - used;
      if (room > 0) out.push({ kind: token.kind, text: cut(token.text, room) });
      out.push({ kind: "punct", text: `${ELLIPSIS})` });
      return out;
    }
    out.push(token);
    used += token.text.length;
  }
  return out;
}

/** What one object says about itself: a name, a tool call's arguments, a body.
 *  `text` is the raw string, snippeted only once the winner is known. */
interface Block {
  name: string | null;
  args: ToolToken[] | null;
  text: string | null;
}

/**
 * A named object with arguments is a tool call and stops there. Otherwise its
 * name (if any) is paired with the body found under `TEXT_KEYS`. A nameless
 * object instead takes everything from the first nested block that has
 * something to say, so a message whose first block is a `tool_use` reads as
 * that call, and name and body always come from the same block.
 */
function blockOf(record: Record<string, unknown>, depth: number): Block | null {
  const name = nameOf(record);
  const input = name === null ? null : argsOf(record);
  if (name !== null && input !== null)
    return { name, args: argTokens(name, input), text: null };
  const inner = innerOf(record, depth);
  if (name === null) return inner;
  return { name, args: null, text: inner?.text ?? null };
}

function innerOf(record: Record<string, unknown>, depth: number): Block | null {
  for (const key of TEXT_KEYS) {
    const found = valueBlock(record[key], depth);
    if (found !== null) return found;
  }
  return null;
}

function valueBlock(value: unknown, depth: number): Block | null {
  // A search, not `trim()`: it stops at the first visible character instead of
  // copying the whole string.
  if (typeof value === "string") {
    return NON_WHITESPACE_RE.test(value)
      ? { name: null, args: null, text: value }
      : null;
  }
  if (depth === 0) return null;
  if (Array.isArray(value)) {
    const end = Math.min(value.length, ARRAY_SCAN);
    for (let i = 0; i < end; i++) {
      const found = valueBlock(value[i], depth - 1);
      if (found !== null) return found;
    }
    return null;
  }
  return isRecord(value) ? blockOf(value, depth - 1) : null;
}

/**
 * A summary for agent traces: messages, content blocks, tool declarations and SSE events in the
 * common LLM wire formats. A tool call reads `Bash(command="ls")`, a message `user "hello…"`.
 * `null` when nothing recognisable was found, leaving the row a bare `{…}`.
 */
export function agentTraceSummary(
  record: Record<string, unknown>,
): JsonSummary | null {
  const tags = tagsOf(record);
  const block = blockOf(record, TEXT_DEPTH);
  if (tags.length === 0 && block === null) return null;
  return {
    // A role reads as the speaker, so it stands out from the kind labels.
    tags: tags.map((tag) =>
      tag.key === "role" ? { ...tag, emphasis: true } : tag,
    ),
    name: block?.name ?? null,
    args: block?.args ?? null,
    text: block?.text ? snippet(block.text) : null,
  };
}
