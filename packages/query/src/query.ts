/**
 * A search query grammar over a schema the app supplies. The app's server
 * parses `q` and executes it (authoritative); its web box parses the same
 * string to colour it and to place completions; a CLI parses it to re-quote
 * the values that carry spaces. One string carries the whole query, so "the
 * same query gives the same results in the CLI and on the web" holds
 * structurally instead of being a discipline two implementations have to
 * keep.
 *
 * Nothing here decides whether a `named` value exists: `label:kind:bug`
 * parses the same in a project that has that label and in one that does
 * not. Names are resolved by the caller, which keeps this module a pure
 * function on either side of the wire.
 */

import { BRACE_LIMIT, expandBraces } from "./braces.ts";
import {
  quoteShellWord,
  type ShellSegment,
  type ShellWord,
  segmentValue,
  shellWords,
} from "./shell-words.ts";
import type { ValueSpec } from "./values.ts";

export type QualifierSpec = {
  value: ValueSpec;
  /** Other spellings of the key itself: `meta` for `metadata`. */
  keyAliases?: readonly string[];
  /** One-line inline reminder in the completion row: "open or closed". */
  hint?: string;
};

export type QuerySchema<K extends string = string> = {
  qualifiers: Readonly<Record<K, QualifierSpec>>;
  /** How quotes and backslashes read. `"plain"` unless set. */
  escapes?: "plain" | "shell";
  /** Brace expansion inside qualifier values. Off unless set. */
  braces?: boolean;
  /** More qualifier expressions than this is a diagnostic. */
  maxFilters?: number;
};

export type CompiledQuerySchema<K extends string = string> = {
  readonly qualifiers: Readonly<Record<K, QualifierSpec>>;
  /** Canonical keys, in declaration order. */
  readonly keys: readonly K[];
  /**
   * Every spelling of a key, lowercase, canonical ones included, mapping to
   * the canonical one. Completion offers only `keys`, so an alias is offered
   * under its canonical spelling and still parses when typed.
   */
  readonly spellings: ReadonlyMap<string, K>;
  readonly escapes: "plain" | "shell";
  readonly braces: boolean;
  readonly maxFilters: number | undefined;
};

const KEY_SPELLING = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * Throws on a malformed table: these are programmer errors in static data,
 * caught at module load rather than on some reader's query.
 */
export function defineQuerySchema<K extends string>(
  schema: QuerySchema<K>,
): CompiledQuerySchema<K> {
  const keys = Object.keys(schema.qualifiers) as K[];
  const spellings = new Map<string, K>();
  for (const key of keys) {
    const spec = schema.qualifiers[key];
    for (const spelling of [key, ...(spec.keyAliases ?? [])]) {
      if (!KEY_SPELLING.test(spelling)) {
        throw new Error(`query key "${spelling}" must match ${KEY_SPELLING}`);
      }
      const lower = spelling.toLowerCase();
      const taken = spellings.get(lower);
      if (taken !== undefined) {
        throw new Error(
          `query key "${spelling}" of "${key}" is already a spelling of "${taken}"`,
        );
      }
      spellings.set(lower, key);
    }
    const value = spec.value;
    if (value.kind === "enum") {
      for (const [alias, canonical] of Object.entries(value.aliases ?? {})) {
        if (!value.values.includes(canonical)) {
          throw new Error(
            `alias "${alias}" of "${key}" names "${canonical}", which is not one of its values`,
          );
        }
      }
    }
  }
  return {
    qualifiers: schema.qualifiers,
    keys,
    spellings,
    escapes: schema.escapes ?? "plain",
    braces: schema.braces ?? false,
    maxFilters: schema.maxFilters,
  };
}

export type QueryValue = {
  start: number;
  end: number;
  /** The source slice, quotes included. */
  raw: string;
  /** What the value means, quotes removed. */
  value: string;
  /** `[value]` unless braces expanded it. */
  expanded: string[];
  /** Why brace expansion failed (over the limit). */
  error?: string;
};

/**
 * A span of the query string. Offsets are UTF-16 indices into the original
 * `q`, so the colouring layer, the diagnostics and the completions all point
 * at the same characters without re-scanning.
 */
export type QueryPart<K extends string = string> =
  | { kind: "space"; start: number; end: number }
  | { kind: "text"; start: number; end: number; raw: string; term: string }
  | {
      kind: "filter";
      start: number;
      end: number;
      raw: string;
      /** Canonical. */
      key: K;
      negated: boolean;
      /** The key as typed, `-` and `:` excluded. */
      keyStart: number;
      keyEnd: number;
      values: QueryValue[];
    };

export type QueryFilter<K extends string = string> = {
  key: K;
  negated: boolean;
  /** Unquoted, expanded and in source order; empty values never reach here. */
  values: string[];
};

const KEY_HEAD = /[A-Za-z]/;
const KEY_BODY = /[A-Za-z0-9_-]/;

const isSpace = (ch: string): boolean => /\s/.test(ch);

function expandedOf(
  schema: CompiledQuerySchema,
  word: ShellWord | string,
  value: string,
): Pick<QueryValue, "expanded" | "error"> {
  if (!schema.braces) return { expanded: [value] };
  const expansion = expandBraces(word, { limit: BRACE_LIMIT });
  return expansion.ok
    ? { expanded: expansion.words }
    : { expanded: [value], error: expansion.reason };
}

/**
 * Where the `{` at `at` closes, when it does before whitespace or a quote
 * ends the value; null leaves it an ordinary character, so text that merely
 * contains a brace reads as it always did.
 */
function closingBrace(q: string, at: number): number | null {
  let depth = 0;
  for (let i = at; i < q.length; i += 1) {
    const ch = q[i] as string;
    if (isSpace(ch) || ch === '"') return null;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null;
}

/**
 * A value: a quoted run, or one stretch of non-space, non-comma, non-quote.
 * With braces on, a balanced `{…}` is absorbed commas and all. A quoted
 * value is never expanded: quoting is how a brace is searched for literally.
 */
function scanPlainValue(
  schema: CompiledQuerySchema,
  q: string,
  at: number,
): QueryValue {
  if (q[at] === '"') {
    const close = q.indexOf('"', at + 1);
    const inner = close === -1 ? q.length : close;
    const end = close === -1 ? q.length : close + 1;
    const value = q.slice(at + 1, inner);
    return { start: at, end, raw: q.slice(at, end), value, expanded: [value] };
  }
  let end = at;
  while (end < q.length) {
    const ch = q[end] as string;
    if (isSpace(ch) || ch === "," || ch === '"') break;
    if (ch === "{" && schema.braces) {
      const close = closingBrace(q, end);
      if (close !== null) {
        end = close + 1;
        continue;
      }
    }
    end += 1;
  }
  const value = q.slice(at, end);
  return {
    start: at,
    end,
    raw: value,
    value,
    ...expandedOf(schema, value, value),
  };
}

/**
 * `-?key:value-list` when `key` is one we know, null otherwise — and "null"
 * is the load-bearing half. `area:web` and `kind:bug` are ordinary label
 * names, `https://…` and a timestamp like `12:30` are ordinary things to
 * search for. Rejecting an unrecognised key would turn such queries into
 * syntax errors, so an unknown key falls through to plain text. Searching a
 * known key literally is still possible by quoting the whole run:
 * `"harness:"`.
 */
function scanPlainFilter<K extends string>(
  schema: CompiledQuerySchema<K>,
  q: string,
  at: number,
): QueryPart<K> | null {
  let i = at;
  const negated = q[i] === "-";
  if (negated) i += 1;
  const keyStart = i;
  if (i >= q.length || !KEY_HEAD.test(q[i] as string)) return null;
  i += 1;
  while (i < q.length && KEY_BODY.test(q[i] as string)) i += 1;
  const keyEnd = i;
  if (q[i] !== ":") return null;
  const key = schema.spellings.get(q.slice(keyStart, keyEnd).toLowerCase());
  if (key === undefined) return null;
  i += 1;

  const values: QueryValue[] = [];
  for (;;) {
    const value = scanPlainValue(schema, q, i);
    i = value.end;
    // An empty value is someone mid-typing (`label:`), not an error and not a
    // condition; the comma that may follow is still consumed so the scan
    // advances.
    if (value.value !== "") values.push(value);
    if (q[i] !== ",") break;
    i += 1;
  }

  return {
    kind: "filter",
    start: at,
    end: i,
    raw: q.slice(at, i),
    key,
    negated,
    keyStart,
    keyEnd,
    values,
  };
}

/**
 * The scan is one pass with no backtracking, deciding at each position in
 * this order: whitespace, a quoted run, a known qualifier, bare text.
 */
function parsePlain<K extends string>(
  schema: CompiledQuerySchema<K>,
  q: string,
): QueryPart<K>[] {
  const parts: QueryPart<K>[] = [];
  let i = 0;
  while (i < q.length) {
    const ch = q[i] as string;
    if (isSpace(ch)) {
      const start = i;
      while (i < q.length && isSpace(q[i] as string)) i += 1;
      parts.push({ kind: "space", start, end: i });
      continue;
    }
    if (ch === '"') {
      const close = q.indexOf('"', i + 1);
      const inner = close === -1 ? q.length : close;
      const end = close === -1 ? q.length : close + 1;
      // An unclosed quote runs to the end rather than failing — the user is
      // mid-typing, and there is exactly one thing they can mean.
      parts.push({
        kind: "text",
        start: i,
        end,
        raw: q.slice(i, end),
        term: q.slice(i + 1, inner),
      });
      i = end;
      continue;
    }
    const filter = scanPlainFilter(schema, q, i);
    if (filter) {
      parts.push(filter);
      i = filter.end;
      continue;
    }
    let end = i;
    // A quote ends a bare run: `ab"cd"` has been two terms since the first
    // version of this scanner, and queries in the wild rely on it.
    while (end < q.length && !isSpace(q[end] as string) && q[end] !== '"') {
      end += 1;
    }
    const raw = q.slice(i, end);
    parts.push({ kind: "text", start: i, end, raw, term: raw });
    i = end;
  }
  return parts;
}

/**
 * A word's characters after `from`, a bare character at a time and a quoted
 * or escaped segment whole, since only bare characters can separate values
 * or group them.
 */
type Unit =
  | { start: number; end: number; bare: string }
  | { start: number; end: number; bare: null; segment: ShellSegment };

function unitsOf(word: ShellWord, from: number): Unit[] {
  const units: Unit[] = [];
  for (const segment of word.segments) {
    if (segment.end <= from) continue;
    if (segment.quoted !== "none") {
      units.push({
        start: segment.start,
        end: segment.end,
        bare: null,
        segment,
      });
      continue;
    }
    for (let i = Math.max(segment.start, from); i < segment.end; i += 1) {
      units.push({
        start: i,
        end: i + 1,
        bare: word.raw[i - word.start] ?? "",
      });
    }
  }
  return units;
}

/** Unit indexes inside a balanced bare `{…}`, where a comma does not split. */
function groupedUnits(units: Unit[]): Set<number> {
  const grouped = new Set<number>();
  const stack: number[] = [];
  for (let i = 0; i < units.length; i += 1) {
    const bare = units[i]?.bare;
    if (bare === "{") stack.push(i);
    else if (bare === "}" && stack.length > 0) {
      const open = stack.pop() as number;
      for (let j = open + 1; j < i; j += 1) grouped.add(j);
    }
  }
  return grouped;
}

/** One value of a shell-mode filter, as a word of its own. */
function shellValue(
  schema: CompiledQuerySchema,
  q: string,
  units: Unit[],
  start: number,
  end: number,
): QueryValue {
  const segments: ShellSegment[] = [];
  for (const unit of units) {
    const last = segments.at(-1);
    if (
      unit.bare !== null &&
      last?.quoted === "none" &&
      last.end === unit.start
    ) {
      last.end = unit.end;
      continue;
    }
    segments.push(
      unit.bare === null
        ? { ...unit.segment }
        : { start: unit.start, end: unit.end, quoted: "none" },
    );
  }
  const raw = q.slice(start, end);
  const piece: ShellWord = { start, end, raw, value: "", segments };
  piece.value = segments.map((s) => segmentValue(piece, s)).join("");
  return {
    start,
    end,
    raw,
    value: piece.value,
    ...expandedOf(schema, piece, piece.value),
  };
}

const SHELL_KEY = /^(-?)([A-Za-z][A-Za-z0-9_-]*):/;

/**
 * A qualifier needs `-?key:` bare at the start of a word, so `"label:x"` and
 * `label\:x` are text: that is how a known key is searched for literally in
 * this mode.
 */
function shellFilter<K extends string>(
  schema: CompiledQuerySchema<K>,
  q: string,
  word: ShellWord,
): QueryPart<K> | null {
  const head = word.segments[0];
  if (head === undefined || head.quoted !== "none") return null;
  const match = SHELL_KEY.exec(q.slice(head.start, head.end));
  if (match === null) return null;
  const [, minus = "", typed = ""] = match;
  const key = schema.spellings.get(typed.toLowerCase());
  if (key === undefined) return null;
  const keyStart = word.start + minus.length;
  const keyEnd = keyStart + typed.length;

  const units = unitsOf(word, keyEnd + 1);
  const grouped = schema.braces ? groupedUnits(units) : new Set<number>();
  const values: QueryValue[] = [];
  let first = 0;
  let start = keyEnd + 1;
  for (let i = 0; i <= units.length; i += 1) {
    const unit = units[i];
    if (unit !== undefined && (unit.bare !== "," || grouped.has(i))) continue;
    const end = unit?.start ?? word.end;
    const value = shellValue(schema, q, units.slice(first, i), start, end);
    // Empty is someone mid-typing, as in plain mode.
    if (value.value !== "") values.push(value);
    first = i + 1;
    start = unit?.end ?? word.end;
  }

  return {
    kind: "filter",
    start: word.start,
    end: word.end,
    raw: word.raw,
    key,
    negated: minus === "-",
    keyStart,
    keyEnd,
    values,
  };
}

function parseShell<K extends string>(
  schema: CompiledQuerySchema<K>,
  q: string,
): QueryPart<K>[] {
  const parts: QueryPart<K>[] = [];
  let at = 0;
  for (const word of shellWords(q)) {
    if (word.start > at)
      parts.push({ kind: "space", start: at, end: word.start });
    parts.push(
      shellFilter(schema, q, word) ?? {
        kind: "text",
        start: word.start,
        end: word.end,
        raw: word.raw,
        term: word.value,
      },
    );
    at = word.end;
  }
  if (at < q.length) parts.push({ kind: "space", start: at, end: q.length });
  return parts;
}

/**
 * `q` split into spans that tile it completely — every character of the input
 * belongs to exactly one part, which is what lets a mirror layer render the
 * string by walking this list.
 *
 * Never throws: a half-typed query is the normal case for a search box, and
 * every shape of input has a reading.
 */
export function parseQuery<K extends string>(
  schema: CompiledQuerySchema<K>,
  q: string,
): QueryPart<K>[] {
  return schema.escapes === "shell"
    ? parseShell(schema, q)
    : parsePlain(schema, q);
}

/** The free-text terms, in source order; an empty `""` contributes nothing. */
export function queryTerms(parts: readonly QueryPart[]): string[] {
  const terms: string[] = [];
  for (const part of parts) {
    if (part.kind === "text" && part.term !== "") terms.push(part.term);
  }
  return terms;
}

/**
 * Brace expansions are flattened, so `label:area:{web,ui}` reaches a server
 * as `label:area:web,area:ui`, which it already reads as an OR.
 */
export function queryFilters<K extends string>(
  parts: readonly QueryPart<K>[],
): QueryFilter<K>[] {
  const filters: QueryFilter<K>[] = [];
  for (const part of parts) {
    if (part.kind !== "filter") continue;
    filters.push({
      key: part.key,
      negated: part.negated,
      values: part.values.flatMap((v) => v.expanded.filter((e) => e !== "")),
    });
  }
  return filters;
}

/**
 * A value spelled so it reads back as one value. Plain mode has no way to
 * spell a quote inside a value — a bare one ends the value — so inner quotes
 * are dropped rather than preserved.
 */
export function quoteQueryValue(
  schema: CompiledQuerySchema,
  value: string,
): string {
  if (schema.escapes === "shell") return quoteShellWord(value);
  const unsafe = schema.braces ? /[\s,"{}]/ : /[\s,"]/;
  return unsafe.test(value) ? `"${value.replaceAll('"', "")}"` : value;
}
