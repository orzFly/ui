// Ported from vanilla-jsoneditor (ISC); see NOTICE. Its tree mode's selection
// (createMultiSelection, the arrow-key moves and selectionToPartialJson) is
// rewritten here over JsonView's flattened rows and string paths.

import { ROOT_KEY } from "./parse.ts";
import {
  ancestorsOf,
  childPath,
  type JsonNodeRow,
  type JsonRow,
  parentPathOf,
  resolvePath,
} from "./tree.ts";
import type { JsonDocument, JsonSelection, NodeFacts } from "./types.ts";

/** The end a range started from; a key or value selection's own path. */
export function anchorOf(selection: JsonSelection): string {
  return selection.type === "members" ? selection.anchor : selection.path;
}

/** The end a range is moving; a key or value selection's own path. */
export function focusOf(selection: JsonSelection): string {
  return selection.type === "members" ? selection.focus : selection.path;
}

export function sameSelection(
  a: JsonSelection | null,
  b: JsonSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === "members" && b.type === "members") {
    return a.anchor === b.anchor && a.focus === b.focus;
  }
  return anchorOf(a) === anchorOf(b);
}

const chainOf = (path: string) => [...ancestorsOf(path), path];

/**
 * A range from `anchor` to `focus`, both raised to the children of their deepest common
 * ancestor, so it always holds siblings. An end that is the other's ancestor (or the same node)
 * makes the range that node alone.
 */
export function liftMembers(anchor: string, focus: string): JsonSelection {
  const a = chainOf(anchor);
  const f = chainOf(focus);
  let shared = 0;
  while (shared < a.length && shared < f.length && a[shared] === f[shared]) {
    shared++;
  }
  if (a.length > shared && f.length > shared) {
    return {
      type: "members",
      anchor: a[shared] as string,
      focus: f[shared] as string,
    };
  }
  const common = a[shared - 1] ?? "$";
  return { type: "members", anchor: common, focus: common };
}

/** Whether `path` lies strictly under `ancestor`. */
export function isInside(path: string, ancestor: string): boolean {
  return (
    path.length > ancestor.length &&
    path.startsWith(ancestor) &&
    (path[ancestor.length] === "." || path[ancestor.length] === "[")
  );
}

/** A row that has a key of its own: an object's member, not an array item or the root. */
export const hasKey = (row: JsonNodeRow) =>
  row.key !== null && row.index === null;

export const isNodeRow = (row: JsonRow | undefined): row is JsonNodeRow =>
  row !== undefined && row.kind !== "comment";

/** Each node row's index by path. */
export function indexRows(rows: readonly JsonRow[]): Map<string, number> {
  const out = new Map<string, number>();
  rows.forEach((row, i) => {
    if (row.kind !== "comment") out.set(row.path, i);
  });
  return out;
}

/** The last row of the subtree at `index`: its last visible descendant or dangling comment. */
export function subtreeEnd(rows: readonly JsonRow[], index: number): number {
  const row = rows[index];
  if (!isNodeRow(row) || !row.expanded) return index;
  let end = index;
  while (
    end + 1 < rows.length &&
    (rows[end + 1] as JsonRow).depth > row.depth
  ) {
    end++;
  }
  return end;
}

type Column = "key" | "value" | "members";

function columnOf(selection: JsonSelection): Column {
  return selection.type;
}

function atColumn(row: JsonNodeRow, column: Column): JsonSelection {
  if (column === "members") {
    return { type: "members", anchor: row.path, focus: row.path };
  }
  if (column === "key" && hasKey(row)) return { type: "key", path: row.path };
  return { type: "value", path: row.path };
}

function stepNode(
  rows: readonly JsonRow[],
  from: number,
  delta: 1 | -1,
): JsonNodeRow | undefined {
  for (let i = from + delta; i >= 0 && i < rows.length; i += delta) {
    const row = rows[i];
    if (isNodeRow(row)) return row;
  }
  return undefined;
}

/** The first and last rows a members range's ends sit on. */
function rangeRows(
  index: Map<string, number>,
  selection: Extract<JsonSelection, { type: "members" }>,
): [number, number] | null {
  const a = index.get(selection.anchor);
  const f = index.get(selection.focus);
  if (a === undefined || f === undefined) return null;
  return a <= f ? [a, f] : [f, a];
}

/**
 * ↑ and ↓: the previous or next node row, skipping comment rows, in the same column. A key stays
 * a key where the row has one and becomes the value where it does not; a range becomes the one
 * member it lands on. ↓ steps over an open range's subtree, as it moves past the range.
 */
export function moveVertical(
  rows: readonly JsonRow[],
  selection: JsonSelection | null,
  delta: 1 | -1,
): JsonSelection | null {
  const index = indexRows(rows);
  if (!selection) {
    const first =
      delta > 0 ? stepNode(rows, -1, 1) : stepNode(rows, rows.length, -1);
    return first ? { type: "value", path: first.path } : null;
  }
  let from: number | undefined;
  if (selection.type === "members") {
    const range = rangeRows(index, selection);
    if (range) from = delta > 0 ? subtreeEnd(rows, range[1]) : range[0];
  } else {
    from = index.get(selection.path);
  }
  // The hidden root has no row of its own: its rows start below it.
  if (from === undefined) from = delta > 0 ? -1 : rows.length;
  const next = stepNode(rows, from, delta);
  return next ? atColumn(next, columnOf(selection)) : selection;
}

/** Shift+↑ and Shift+↓: moves a range's focus by a row, re-lifted to siblings of the anchor. */
export function extendVertical(
  rows: readonly JsonRow[],
  selection: JsonSelection | null,
  delta: 1 | -1,
): JsonSelection | null {
  if (!selection) return moveVertical(rows, selection, delta);
  const index = indexRows(rows);
  const focus = focusOf(selection);
  const at = index.get(focus);
  if (at === undefined) return selection;
  // Down from an open container moves past its subtree, not into it.
  const next = stepNode(rows, delta > 0 ? subtreeEnd(rows, at) : at, delta);
  if (!next) return selection;
  return liftMembers(anchorOf(selection), next.path);
}

/**
 * →: from a key to its value; from an open container's value to its first child, at its key
 * where it has one. Expanding a collapsed container is the view's, before this.
 */
export function moveRight(
  rows: readonly JsonRow[],
  selection: JsonSelection,
): JsonSelection {
  if (selection.type === "key") return { type: "value", path: selection.path };
  if (selection.type === "members") {
    return { type: "value", path: selection.focus };
  }
  const index = indexRows(rows);
  const at = index.get(selection.path);
  const row = at === undefined ? undefined : rows[at];
  const open =
    selection.path === "$" ? rows.length > 0 : isNodeRow(row) && row.expanded;
  if (!open) return selection;
  const child = stepNode(rows, at ?? -1, 1);
  if (
    !child ||
    (at !== undefined && child.depth <= (row as JsonNodeRow).depth)
  ) {
    return selection;
  }
  return atColumn(child, "key");
}

/**
 * ←: from a value that has a key to the key; otherwise to the parent, as a member. Collapsing an
 * open container is the view's, before this.
 */
export function moveLeft(
  rows: readonly JsonRow[],
  selection: JsonSelection,
): JsonSelection {
  const path = focusOf(selection);
  if (selection.type === "value") {
    const at = indexRows(rows).get(path);
    const row = at === undefined ? undefined : rows[at];
    if (isNodeRow(row) && hasKey(row)) return { type: "key", path };
  }
  const parent = parentPathOf(path);
  if (!parent) return selection;
  return { type: "members", anchor: parent, focus: parent };
}

/** Home and End: the first or last node row, in the same column. */
export function moveToEnd(
  rows: readonly JsonRow[],
  selection: JsonSelection | null,
  end: "first" | "last",
): JsonSelection | null {
  const row =
    end === "first" ? stepNode(rows, -1, 1) : stepNode(rows, rows.length, -1);
  if (!row) return selection;
  return atColumn(row, selection ? columnOf(selection) : "value");
}

/** Ctrl+A: the root value. */
export const selectAll = (): JsonSelection => ({ type: "value", path: "$" });

export interface SelectionGeometry {
  kind: Column;
  /** The first row the block covers; for a range, its first member's first leading comment. */
  first: number;
  /** The last row the block covers: the last member's last visible descendant. */
  last: number;
  /** The depth the block starts at on every row but a value's own. */
  depth: number;
  /** Whether `first` is the value's own row, where the block starts at the value, not the indent. */
  ownRow: boolean;
}

/** Where a selection is drawn, in rows; `null` when it is not on any row shown. */
export function selectionRows(
  rows: readonly JsonRow[],
  selection: JsonSelection | null,
): SelectionGeometry | null {
  if (!selection || rows.length === 0) return null;
  const index = indexRows(rows);
  if (selection.type === "members") {
    const range = rangeRows(index, selection);
    if (!range) {
      if (selection.anchor === "$" && selection.focus === "$") {
        return {
          kind: "members",
          first: 0,
          last: rows.length - 1,
          depth: 0,
          ownRow: false,
        };
      }
      return null;
    }
    const [start, end] = range;
    let first = start;
    const startPath = (rows[start] as JsonRow).path;
    while (first > 0) {
      const above = rows[first - 1] as JsonRow;
      if (above.kind !== "comment" || above.member !== startPath) break;
      first--;
    }
    return {
      kind: "members",
      first,
      last: subtreeEnd(rows, end),
      depth: (rows[start] as JsonRow).depth,
      ownRow: false,
    };
  }
  const at = index.get(selection.path);
  if (at === undefined) {
    if (selection.path === "$" && selection.type === "value") {
      return {
        kind: "value",
        first: 0,
        last: rows.length - 1,
        depth: 0,
        ownRow: false,
      };
    }
    return null;
  }
  const row = rows[at] as JsonNodeRow;
  if (selection.type === "key") {
    return { kind: "key", first: at, last: at, depth: row.depth, ownRow: true };
  }
  return {
    kind: "value",
    first: at,
    last: subtreeEnd(rows, at),
    depth: row.depth + 1,
    ownRow: true,
  };
}

/**
 * After a container collapses, a selection inside it moves to the container's member, which is
 * still on a row.
 */
export function selectionAfterCollapse(
  selection: JsonSelection | null,
  collapsed: string,
): JsonSelection | null {
  if (!selection) return selection;
  if (
    isInside(anchorOf(selection), collapsed) ||
    isInside(focusOf(selection), collapsed)
  ) {
    return { type: "members", anchor: collapsed, focus: collapsed };
  }
  return selection;
}

/** Whether a selection names something in `value`. */
export function selectionExists(
  value: unknown,
  selection: JsonSelection,
): boolean {
  if (selection.type === "members") {
    return (
      resolvePath(value, selection.anchor).found &&
      resolvePath(value, selection.focus).found &&
      parentPathOf(selection.anchor) === parentPathOf(selection.focus)
    );
  }
  const found = resolvePath(value, selection.path);
  if (!found.found) return false;
  return (
    selection.type === "value" ||
    (found.parent !== null && !Array.isArray(found.parent))
  );
}

/**
 * A `JsonDocument`, told from a bare value by its `source` text or its `facts` function, beside
 * its `value`.
 */
export function asDocument(input: unknown): JsonDocument {
  if (
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    "value" in input &&
    (typeof (input as JsonDocument).facts === "function" ||
      typeof (input as JsonDocument).source === "string") &&
    Object.keys(input).every(
      (k) => k === "value" || k === "source" || k === "facts",
    )
  ) {
    return input as JsonDocument;
  }
  return { value: input };
}

/** The members a range covers, in order: their paths and keys, under their parent. */
export function membersOf(
  value: unknown,
  selection: Extract<JsonSelection, { type: "members" }>,
): {
  parent: object | null;
  parentPath: string | null;
  members: { path: string; key: string | number; value: unknown }[];
} | null {
  const anchor = resolvePath(value, selection.anchor);
  const focus = resolvePath(value, selection.focus);
  if (!anchor.found || !focus.found) return null;
  const parent = anchor.parent;
  if (parent !== focus.parent) return null;
  const parentPath = parentPathOf(selection.anchor);
  if (parent === null || parentPath === null) {
    return {
      parent: null,
      parentPath: null,
      members: [{ path: "$", key: ROOT_KEY, value: anchor.value }],
    };
  }
  const keys: (string | number)[] = Array.isArray(parent)
    ? parent.map((_, i) => i)
    : Object.keys(parent);
  const a = keys.indexOf(anchor.key);
  const f = keys.indexOf(focus.key);
  const [from, to] = a <= f ? [a, f] : [f, a];
  const members = keys.slice(from, to + 1).map((key) => {
    const path =
      typeof key === "number"
        ? childPath(parentPath, String(key), key)
        : childPath(parentPath, key, null);
    return {
      path,
      key,
      value: (parent as Record<string | number, unknown>)[key],
    };
  });
  return { parent, parentPath, members };
}

function stringify(value: unknown, compact: boolean): string | null {
  try {
    const text = compact
      ? JSON.stringify(value)
      : JSON.stringify(value, null, 2);
    return text === undefined ? null : text;
  } catch {
    return null;
  }
}

/**
 * The text Ctrl+C copies for a selection: a key's text; a string value raw and any other value
 * as JSON; an object's members as `"key": <json>,` lines and an array's items as `<json>,`
 * lines (one item alone, bare); the root, the whole document. `compact` writes the JSON on one
 * line. `null` when a value cannot be serialised (a cycle, a BigInt), or the selection names
 * nothing. `document` may be a `JsonDocument` or the bare value.
 */
export function selectionText(
  document: JsonDocument | unknown,
  selection: JsonSelection,
  options: { compact?: boolean } = {},
): string | null {
  return selectionTextOf(asDocument(document).value, selection, options);
}

/** `selectionText` over the value itself, for a caller that already holds it. */
export function selectionTextOf(
  value: unknown,
  selection: JsonSelection,
  options: { compact?: boolean } = {},
): string | null {
  const compact = options.compact ?? false;
  if (selection.type === "key") {
    const found = resolvePath(value, selection.path);
    return found.found ? String(found.key) : null;
  }
  if (selection.type === "value") {
    const found = resolvePath(value, selection.path);
    if (!found.found) return null;
    return typeof found.value === "string"
      ? found.value
      : stringify(found.value, compact);
  }
  const range = membersOf(value, selection);
  if (!range) return null;
  if (range.parent === null) return stringify(value, compact);
  if (Array.isArray(range.parent)) {
    if (range.members.length === 1) {
      return stringify((range.members[0] as { value: unknown }).value, compact);
    }
    const lines: string[] = [];
    for (const member of range.members) {
      const json = stringify(member.value, compact);
      if (json === null) return null;
      lines.push(`${json},`);
    }
    return lines.join("\n");
  }
  const lines: string[] = [];
  for (const member of range.members) {
    const json = stringify(member.value, compact);
    if (json === null) return null;
    lines.push(`${JSON.stringify(String(member.key))}: ${json},`);
  }
  return lines.join("\n");
}

/**
 * A selection's exact slice of the document's source, comments and formatting kept: a value's
 * range, or from a range's first member's first leading comment to its last member's end.
 * `undefined` when the document has no source, or for a key.
 */
export function selectionSource(
  document: JsonDocument,
  selection: JsonSelection,
): string | undefined {
  const { source, facts, value } = document;
  if (source === undefined || !facts || selection.type === "key") {
    return undefined;
  }
  const factsAt = (path: string): NodeFacts | undefined => {
    const found = resolvePath(value, path);
    return found.found ? facts(found.parent, found.key) : undefined;
  };
  if (selection.type === "value") {
    const at = factsAt(selection.path);
    return at ? source.slice(...at.range) : undefined;
  }
  const range = membersOf(value, selection);
  if (!range || range.members.length === 0) return undefined;
  const first = factsAt((range.members[0] as { path: string }).path);
  const last = factsAt((range.members.at(-1) as { path: string }).path);
  if (!first || !last) return undefined;
  const start =
    first.leading?.[0]?.range[0] ?? (first.memberRange ?? first.range)[0];
  const end = (last.memberRange ?? last.range)[1];
  return source.slice(start, end);
}
