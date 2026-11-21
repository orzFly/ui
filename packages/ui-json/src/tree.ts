// Ported from PicoTera (BSD-3-Clause); see NOTICE.
/**
 * The tree model behind `JsonView`.
 *
 * The view never renders a component tree: it flattens the *currently visible* nodes into one
 * array and hands that to a virtualizer, so the work is bounded by the number of expanded nodes
 * and the rows on screen, never by the payload size. A collapsed container costs exactly one row
 * no matter how large its subtree is, and a string's preview is escaped from a bounded slice
 * rather than the whole value, so a multi-megabyte string never gets stringified to fill one row.
 */

import { ROOT_KEY } from "./parse.ts";
import type { JsonDocument, JsonSummary, NodeFacts } from "./types.ts";

export type JsonKind =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

/** A row for a node. `path` doubles as the identity key. */
export interface JsonNodeRow {
  kind: JsonKind;
  /** Stable display path, e.g. `$.messages[0].role`. Also the virtualizer key. */
  path: string;
  key: string | null;
  /** 0-based array index, `null` for object members and the root. */
  index: number | null;
  depth: number;
  /** The raw value, held by reference, never a copy. */
  value: unknown;
  /** Object/array member count; string length for strings; 0 otherwise. */
  size: number;
  /** One-line preview: escaped string body (truncated), primitive text, or a container placeholder. */
  preview: string;
  /** True when `preview` was cut short by the preview limit. */
  truncated: boolean;
  /** Set on a collapsed, non-empty object when a summary function finds something to say. */
  summary: JsonSummary | null;
  expandable: boolean;
  expanded: boolean;
  /** A comment after the value on the member's line, in one line. */
  trailing: string | null;
  /** YAML's marks before the value, as written: `&defaults`, `&defaults !!binary`, `*defaults`. */
  mark: string | null;
  /** An alias's anchor's path, for Go to anchor. */
  anchorPath: string | null;
}

/** One source line of a comment, on a row of its own. */
export interface JsonCommentRow {
  kind: "comment";
  /** `<member path>#c<n>`. */
  path: string;
  /** The path of the member the comment belongs to: before it, or, in a container, after its last child. */
  member: string;
  depth: number;
  text: string;
}

export type JsonRow = JsonNodeRow | JsonCommentRow;

type Facts = JsonDocument["facts"];

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Characters shown before a string preview is cut. */
export const PREVIEW_LIMIT = 160;

/**
 * The cut in soft-wrap mode: a wrapped row has room for more than one line, but still stays a few
 * lines tall rather than a screenful.
 */
export const WRAP_PREVIEW_LIMIT = 1000;

/** Rows the walk will produce before it gives up, so a pathological payload cannot freeze the tab. */
export const ROW_BUDGET = 20000;

/** Nodes `searchPaths` will visit before giving up. */
export const SEARCH_BUDGET = 300000;

export function kindOf(value: unknown): JsonKind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object":
      return "object";
    case "number":
    case "bigint":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

export function isContainer(kind: JsonKind | "comment"): boolean {
  return kind === "object" || kind === "array";
}

/**
 * `$.a.b`, `$["odd key"]`, `$.list[3]`: a JS/JSONPath-flavoured accessor. A key that is not a
 * plain identifier is bracket-quoted, so a key holding brackets, dots or quotes can never be
 * confused with an index. Every child path extends its parent string, which is what makes the
 * ancestor scan in `ancestorsOf` sound.
 */
export function childPath(
  parent: string,
  key: string,
  index: number | null,
): string {
  if (index !== null) return `${parent}[${index}]`;
  if (IDENT_RE.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}

/** Member count, computed without materialising children. */
function sizeOf(value: unknown, kind: JsonKind): number {
  if (kind === "array") return (value as unknown[]).length;
  if (kind === "object") return Object.keys(value as object).length;
  if (kind === "string") return (value as string).length;
  return 0;
}

/** Cut to `limit` UTF-16 units without splitting a surrogate pair. */
export function cutText(text: string, limit: number): string {
  let chunk = text.slice(0, limit);
  const last = chunk.charCodeAt(chunk.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) chunk = chunk.slice(0, -1);
  return chunk;
}

/**
 * Escape a bounded slice instead of the whole value: `JSON.stringify` over a multi-megabyte
 * string, just to show 160 characters of it, is the most expensive thing a naive viewer does.
 */
function stringPreview(
  text: string,
  limit: number,
): { preview: string; truncated: boolean } {
  if (text.length <= limit) {
    return { preview: JSON.stringify(text), truncated: false };
  }
  const chunk = cutText(text, limit);
  return { preview: `${JSON.stringify(chunk).slice(1, -1)}…`, truncated: true };
}

function literalPreview(
  literal: string,
  limit: number,
): { preview: string; truncated: boolean } {
  if (literal.length <= limit) return { preview: literal, truncated: false };
  return { preview: `${cutText(literal, limit)}…`, truncated: true };
}

function previewOf(
  kind: JsonKind,
  value: unknown,
  size: number,
  limit: number,
  items: (n: number) => string,
  literal: string | undefined,
): { preview: string; truncated: boolean } {
  switch (kind) {
    case "object":
    case "array":
      if (size === 0)
        return { preview: kind === "array" ? "[]" : "{}", truncated: false };
      // An array's length says something about the data; an object's key count mostly
      // doesn't, and the keys show up as soon as it is expanded.
      return {
        preview: kind === "array" ? items(size) : "{…}",
        truncated: false,
      };
    case "null":
      return { preview: literal ?? "null", truncated: false };
    case "string":
      if (literal !== undefined) return literalPreview(literal, limit);
      return size === 0
        ? { preview: '""', truncated: false }
        : stringPreview(value as string, limit);
    default:
      return { preview: literal ?? String(value), truncated: false };
  }
}

/** A comment's text as rows: one per source line, indentation trimmed. */
export function commentLines(text: string): string[] {
  return text.split(/\r\n|[\n\r\u2028\u2029]/).map((line) => line.trim());
}

/** The anchor and tag a member is written with, or the alias it is. */
export function markOf(facts: NodeFacts | undefined): string | null {
  if (!facts) return null;
  if (facts.alias) return `*${facts.alias.name}`;
  const parts: string[] = [];
  if (facts.anchor !== undefined) parts.push(`&${facts.anchor}`);
  if (facts.tag !== undefined) parts.push(facts.tag);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** An alias inside the node it names: its value holds itself, so no walk goes into it. */
export const isRecursive = (facts: NodeFacts | undefined) =>
  facts?.alias?.recursive === true;

/** A trailing comment drawn on its member's row, its lines run together. */
function oneLine(text: string): string {
  return text.replace(/\s*(?:\r\n|[\n\r\u2028\u2029])\s*/g, " ");
}

/** The lines of a member's leading comments, and of a container's dangling ones. */
function commentRowsOf(facts: NodeFacts | undefined): {
  leading: string[];
  dangling: string[];
} {
  const leading: string[] = [];
  const dangling: string[] = [];
  for (const comment of facts?.leading ?? [])
    leading.push(...commentLines(comment.text));
  for (const comment of facts?.dangling ?? [])
    dangling.push(...commentLines(comment.text));
  return { leading, dangling };
}

const commentKey = (member: string, n: number) => `${member}#c${n}`;

const NO_ITEMS = (n: number) => `[${n} items]`;

export interface FlattenResult {
  rows: JsonRow[];
  /** The walk hit `ROW_BUDGET`; the list is a prefix of the real one. */
  limited: boolean;
}

export interface FlattenOptions {
  expanded: ReadonlySet<string>;
  /**
   * When set (search mode), only these paths are listed, and every container on the way to a
   * match renders expanded regardless of `expanded`.
   */
  visible?: ReadonlySet<string> | null;
  /** Characters of a string shown before its preview is cut. */
  previewLimit?: number;
  facts?: Facts;
  summary?: ((record: Record<string, unknown>) => JsonSummary | null) | null;
  /** A collapsed array's placeholder, given its length. */
  items?: (n: number) => string;
}

/**
 * Walk the value depth-first, emitting a row per visible node and per line of each visible
 * comment.
 *
 * Iterative rather than recursive: JSON nested a few thousand levels deep is a legal payload,
 * and a recursive walk would blow the call stack on it.
 */
export function flatten(
  value: unknown,
  options: FlattenOptions,
): FlattenResult {
  const {
    expanded,
    visible = null,
    previewLimit = PREVIEW_LIMIT,
    facts,
    summary,
    items = NO_ITEMS,
  } = options;
  const searchMode = visible !== null;

  const rows: JsonRow[] = [];
  let limited = false;

  type Frame =
    | {
        dangling?: undefined;
        key: string | null;
        index: number | null;
        depth: number;
        path: string;
        value: unknown;
        kind: JsonKind;
        facts: NodeFacts | undefined;
      }
    | { dangling: string[]; from: number; depth: number; path: string };

  // A non-empty root container gets no row of its own: it is always open, so a row for it
  // would only add a blank first line and a level of indentation. Its members start at
  // depth 0. A scalar or empty root still shows as one row.
  const rootKind = kindOf(value);
  const rootHidden = isContainer(rootKind) && sizeOf(value, rootKind) > 0;
  const stack: Frame[] = [
    {
      key: null,
      index: null,
      depth: rootHidden ? -1 : 0,
      path: "$",
      value,
      kind: rootKind,
      facts: facts?.(null, ROOT_KEY),
    },
  ];

  const push = (row: JsonRow) => {
    rows.push(row);
    if (rows.length >= ROW_BUDGET) limited = true;
    return limited;
  };

  const pushComments = (
    lines: string[],
    from: number,
    member: string,
    depth: number,
  ) => {
    for (let i = 0; i < lines.length; i++) {
      const path = commentKey(member, from + i);
      if (searchMode && !visible.has(path)) continue;
      if (
        push({ kind: "comment", path, member, depth, text: lines[i] as string })
      ) {
        return true;
      }
    }
    return false;
  };

  while (stack.length > 0 && !limited) {
    const frame = stack.pop() as Frame;
    if (frame.dangling) {
      pushComments(frame.dangling, frame.from, frame.path, frame.depth);
      continue;
    }
    if (searchMode && !visible.has(frame.path)) continue;

    const { kind } = frame;
    const size = sizeOf(frame.value, kind);
    const expandable =
      isContainer(kind) && size > 0 && !isRecursive(frame.facts);
    const preview = previewOf(
      kind,
      frame.value,
      size,
      previewLimit,
      items,
      frame.facts?.literal,
    );
    const hidden = rootHidden && frame.path === "$";
    // Under a search term every surviving container opens, so a match nested deeper than the
    // user's expand state is actually reachable.
    const expandedHere =
      expandable && (hidden || searchMode || expanded.has(frame.path));
    const comments = commentRowsOf(frame.facts);
    const rowDepth = hidden ? 0 : frame.depth;

    if (pushComments(comments.leading, 0, frame.path, rowDepth)) break;

    if (!hidden) {
      const trailing = frame.facts?.trailing;
      const pushed = push({
        kind,
        path: frame.path,
        key: frame.key,
        index: frame.index,
        depth: frame.depth,
        value: frame.value,
        size,
        // `{…}` only stands in for hidden members; once they are listed below it says
        // nothing. An array keeps its count, since the length still helps.
        preview: expandedHere && kind === "object" ? "" : preview.preview,
        truncated: preview.truncated,
        summary:
          summary && kind === "object" && expandable && !expandedHere
            ? summary(frame.value as Record<string, unknown>)
            : null,
        expandable,
        expanded: expandedHere,
        trailing: trailing ? oneLine(trailing.text) : null,
        mark: markOf(frame.facts),
        anchorPath: frame.facts?.alias?.path ?? null,
      });
      if (pushed) break;
    }

    // Dangling comments sit inside the container, after its last child, so they fold with
    // it; the root's, which are also the comments after the root value, always show.
    if (comments.dangling.length > 0 && (expandedHere || frame.path === "$")) {
      stack.push({
        dangling: comments.dangling,
        from: comments.leading.length,
        depth:
          frame.path === "$" && !hidden && !expandedHere
            ? frame.depth
            : frame.depth + 1,
        path: frame.path,
      });
    }

    if (!expandedHere) continue;

    const depth = frame.depth + 1;
    const parent = frame.path;
    const container = frame.value as object;
    if (kind === "array") {
      const list = frame.value as unknown[];
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        stack.push({
          key: String(i),
          index: i,
          depth,
          path: `${parent}[${i}]`,
          value: item,
          kind: kindOf(item),
          facts: facts?.(container, i),
        });
      }
    } else {
      const record = frame.value as Record<string, unknown>;
      const keys = Object.keys(record);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i] as string;
        const item = record[k];
        stack.push({
          key: k,
          index: null,
          depth,
          path: childPath(parent, k, null),
          value: item,
          kind: kindOf(item),
          facts: facts?.(container, k),
        });
      }
    }
  }

  return { rows, limited };
}

/**
 * Every proper prefix of a path that ends on a segment boundary: the string form of "this
 * node's ancestors", derived without keeping parent pointers. Outermost first, so the *parent*
 * is the last entry and the node itself is never included. A quoted segment is skipped over so
 * a key holding `.` or `[` cannot produce a phantom ancestor.
 */
export function ancestorsOf(path: string): string[] {
  const out: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "." || ch === "[") out.push(path.slice(0, i));
  }
  return out;
}

/** The parent path of `path`, or `null` for the root. */
export function parentPathOf(path: string): string | null {
  return ancestorsOf(path).at(-1) ?? null;
}

/** The keys and indexes a path names, outermost first: `$.a[2]["b c"]` is `["a", 2, "b c"]`. */
export function pathSegments(path: string): (string | number)[] | null {
  if (!path.startsWith("$")) return null;
  const out: (string | number)[] = [];
  let i = 1;
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(path.slice(i + 1));
      if (!match) return null;
      out.push(match[0]);
      i += 1 + match[0].length;
    } else if (ch === "[" && path[i + 1] === '"') {
      let j = i + 2;
      while (j < path.length && path[j] !== '"') j += path[j] === "\\" ? 2 : 1;
      try {
        out.push(JSON.parse(path.slice(i + 1, j + 1)) as string);
      } catch {
        return null;
      }
      if (path[j + 1] !== "]") return null;
      i = j + 2;
    } else if (ch === "[") {
      const match = /^\[(\d+)\]/.exec(path.slice(i));
      if (!match) return null;
      out.push(Number(match[1]));
      i += match[0].length;
    } else {
      return null;
    }
  }
  return out;
}

/** What a path names in `value`: the node, and the container and key it sits under. */
export function resolvePath(
  value: unknown,
  path: string,
):
  | { found: true; value: unknown; parent: object | null; key: string | number }
  | { found: false } {
  const segments = pathSegments(path);
  if (!segments) return { found: false };
  let node = value;
  let parent: object | null = null;
  let key: string | number = ROOT_KEY;
  for (const segment of segments) {
    if (node === null || typeof node !== "object") return { found: false };
    if (Array.isArray(node) !== (typeof segment === "number")) {
      return { found: false };
    }
    if (!Object.hasOwn(node, segment)) return { found: false };
    parent = node;
    key = segment;
    node = (node as Record<string | number, unknown>)[segment];
  }
  return { found: true, value: node, parent, key };
}

export interface SearchResult {
  /** Matches, their ancestors, everything *inside* a matched container, and comment rows shown. */
  visible: Set<string>;
  /** Matched nodes and comment rows. */
  matched: Set<string>;
  /** The scan stopped at `SEARCH_BUDGET` visited nodes; matches may be missing. */
  limited: boolean;
}

/**
 * Full-depth scan for keys, leaf values and comments containing `query`.
 *
 * Unlike `flatten` this cannot stop early (a match may sit under a collapsed subtree), so it is
 * bounded by a visited-node budget instead. Visibility is decided on the way *out* of each node,
 * so a container survives exactly when it matched or something below it did, and a matched
 * container keeps its subtree.
 */
export function searchPaths(
  value: unknown,
  query: string,
  options: { facts?: Facts; budget?: number } = {},
): SearchResult {
  const { facts, budget = SEARCH_BUDGET } = options;
  const needle = query.trim().toLowerCase();
  const visible = new Set<string>();
  const matched = new Set<string>();
  let limited = false;
  let visited = 0;

  interface Node {
    key: string | null;
    index: number | null;
    path: string;
    value: unknown;
    kind: JsonKind;
    facts: NodeFacts | undefined;
    parent: Node | null;
    /** An ancestor matched, so this whole subtree is on show. */
    underMatch: boolean;
    selfMatch: boolean;
    childHit: boolean;
  }

  const root: Node = {
    key: null,
    index: null,
    path: "$",
    value,
    kind: kindOf(value),
    facts: facts?.(null, ROOT_KEY),
    parent: null,
    underMatch: false,
    selfMatch: false,
    childHit: false,
  };

  const hits = (text: string) => text.toLowerCase().includes(needle);

  // A comment row shows when its own line matches, or when the node it belongs to is on show
  // whole; a line that matches makes its node lead to a match.
  const scanComments = (
    node: Node,
    lines: string[],
    from: number,
    whole: boolean,
  ) => {
    for (let i = 0; i < lines.length; i++) {
      const key = commentKey(node.path, from + i);
      if (hits(lines[i] as string)) {
        matched.add(key);
        visible.add(key);
        node.childHit = true;
      } else if (whole) {
        visible.add(key);
      }
    }
  };

  // Enter/exit markers give the post-order decision without recursion.
  type Step = { enter: boolean; node: Node };
  const stack: Step[] = [{ enter: true, node: root }];

  while (stack.length > 0) {
    const step = stack.pop() as Step;
    const node = step.node;

    if (!step.enter) {
      // Visible when it matched, when it leads to a match, or when an ancestor matched. A
      // container nobody under matched drops out with its children.
      if (node.selfMatch || node.childHit || node.underMatch) {
        visible.add(node.path);
        if (node.parent && !node.parent.selfMatch) node.parent.childHit = true;
      }
      continue;
    }

    if (visited++ >= budget) {
      limited = true;
      break;
    }

    if (node.key !== null) node.selfMatch = hits(node.key);
    if (!node.selfMatch && node.index !== null) {
      node.selfMatch = String(node.index).includes(needle);
    }
    const container = isContainer(node.kind);
    if (!node.selfMatch && !container) {
      const literal = node.facts?.literal;
      const text =
        node.kind === "string" ? (node.value as string) : String(node.value);
      node.selfMatch = hits(text) || (literal !== undefined && hits(literal));
    }
    if (!node.selfMatch) {
      const mark = markOf(node.facts);
      node.selfMatch = mark !== null && hits(mark);
    }
    if (node.selfMatch) {
      matched.add(node.path);
      if (container) visible.add(node.path);
    }
    const comments = commentRowsOf(node.facts);
    scanComments(node, comments.leading, 0, node.underMatch);
    scanComments(
      node,
      comments.dangling,
      comments.leading.length,
      node.underMatch || node.selfMatch,
    );
    const trailing = node.facts?.trailing;
    if (trailing && hits(trailing.text)) {
      matched.add(`${node.path}#t`);
      node.childHit = true;
    }

    stack.push({ enter: false, node });
    if (!container || isRecursive(node.facts)) continue;

    const underMatch = node.underMatch || node.selfMatch;
    const holder = node.value as object;
    const make = (
      key: string | null,
      index: number | null,
      path: string,
      child: unknown,
    ): Node => ({
      key,
      index,
      path,
      value: child,
      kind: kindOf(child),
      facts: facts?.(holder, index ?? (key as string)),
      parent: node,
      underMatch,
      selfMatch: false,
      childHit: false,
    });

    if (node.kind === "array") {
      const list = node.value as unknown[];
      for (let i = list.length - 1; i >= 0; i--) {
        stack.push({
          enter: true,
          node: make(String(i), i, `${node.path}[${i}]`, list[i]),
        });
      }
    } else {
      const record = node.value as Record<string, unknown>;
      const keys = Object.keys(record);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i] as string;
        stack.push({
          enter: true,
          node: make(k, null, childPath(node.path, k, null), record[k]),
        });
      }
    }
  }

  return { visible, matched, limited };
}

/**
 * Every expandable path under `value`, for "expand subtree" and "expand all". With `facts`, a
 * recursive alias is left closed.
 */
export function collectExpandable(
  value: unknown,
  fromPath: string,
  limit: number,
  facts?: Facts,
): { paths: string[]; limited: boolean } {
  const paths: string[] = [];
  let limited = false;

  const stack: { value: unknown; path: string }[] = [{ value, path: fromPath }];

  while (stack.length > 0) {
    const frame = stack.pop() as { value: unknown; path: string };
    const kind = kindOf(frame.value);
    if (!isContainer(kind)) continue;
    const size = sizeOf(frame.value, kind);
    if (size === 0) continue;
    if (paths.length >= limit) {
      limited = true;
      break;
    }
    paths.push(frame.path);
    const container = frame.value as object;
    if (kind === "array") {
      const list = frame.value as unknown[];
      for (let i = list.length - 1; i >= 0; i--) {
        if (isRecursive(facts?.(container, i))) continue;
        stack.push({ value: list[i], path: `${frame.path}[${i}]` });
      }
    } else {
      const record = frame.value as Record<string, unknown>;
      const keys = Object.keys(record);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i] as string;
        if (isRecursive(facts?.(container, k))) continue;
        stack.push({ value: record[k], path: childPath(frame.path, k, null) });
      }
    }
  }
  return { paths, limited };
}

/**
 * Text a value copies as: the bare string for a string, compact JSON for anything else.
 * Containers are rebuilt from the live value, so this is only ever called on demand.
 */
export function rawTextOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  return compactJsonOf(value) ?? String(value);
}

/** Pretty-printed JSON, or `null` when the value cannot be serialised (a cycle, a BigInt, a function). */
export function prettyJsonOf(value: unknown, indent = 2): string | null {
  try {
    const text = JSON.stringify(value, null, indent);
    return text === undefined ? null : text;
  } catch {
    return null;
  }
}

/** Compact one-line JSON, or `null` when the value cannot be serialised. */
export function compactJsonOf(value: unknown): string | null {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : text;
  } catch {
    return null;
  }
}

/** Whether a string leaf holds a JSON document worth a parsed view; called only when asked for. */
export function parseJsonText(
  text: string,
): { ok: true; value: unknown } | { ok: false } {
  const first = text.trimStart()[0];
  if (first !== "{" && first !== "[") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** A human-readable count: `950`, `12.4k`, `120k`, `5.2M`. */
export function formatChars(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}
