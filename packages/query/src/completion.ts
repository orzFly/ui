/**
 * Completion at the caret, the pure half: what is being typed, where it
 * starts and ends, and which values fit. Fetching and rendering stay with
 * the editor that asks — a search box and a CodeMirror panel read the same
 * slot.
 */

import { type CommandRegistry, rawWord } from "./commands.ts";
import {
  type CompiledQuerySchema,
  type QueryPart,
  quoteQueryValue,
} from "./query.ts";
import {
  quoteShellWord,
  type ShellWord,
  segmentValue,
  shellWords,
} from "./shell-words.ts";
import type { ValueOption, ValueProvider, ValueSpec } from "./values.ts";

/** Offsets are into the query, or into the line for the command kinds. */
export type CompletionSlot =
  | { kind: "key"; from: number; to: number; typed: string; negated: boolean }
  | {
      kind: "value";
      from: number;
      to: number;
      typed: string;
      spec: ValueSpec;
      key: string;
      /** Only the current alternative of a brace group is the slot. */
      inBraces: boolean;
    }
  | { kind: "command"; from: number; to: number; typed: string }
  | {
      kind: "argument";
      from: number;
      to: number;
      typed: string;
      spec: ValueSpec;
      command: string;
      index: number;
      last: boolean;
      optional: boolean;
      /** A rest argument's raw remainder, where a value goes in as typed. */
      rest: boolean;
      inBraces: boolean;
    };

export type ValueSlot = Extract<
  CompletionSlot,
  { kind: "value" } | { kind: "argument" }
>;

/**
 * What one source offers, and whether the caret is actually on something it
 * recognises. `matched` is the whole ordering rule: a source that only
 * *could* be useful stays below the submit row.
 */
export type SourceResult<Row> = {
  matched: boolean;
  rows: readonly Row[];
  /** Takes only what the other sources left, and never crowds them out. */
  yields?: boolean;
};

/**
 * One offered completion. A single line: an icon, the syntax in a monospace
 * run, and at most a very short grey note beside it — never a second line of
 * description. The dropdown is something to glance at mid-keystroke.
 */
export type CompletionRow = {
  id: string;
  /** The syntax itself, e.g. `harness:` or `area:web`. */
  text: string;
  /** A few words at most, on the same line. */
  hint?: string;
  icon: "key" | "value";
  /** The whole query after accepting this, and where the caret lands. */
  apply: { value: string; caret: number };
};

const EMPTY: SourceResult<CompletionRow> = { matched: false, rows: [] };

/** A piece of a word: one bare character, or a quoted or escaped segment. */
type Unit = { start: number; end: number; bare: string | null; text: string };

function unitsOf(word: ShellWord, from: number): Unit[] {
  const units: Unit[] = [];
  for (const segment of word.segments) {
    if (segment.end <= from) continue;
    if (segment.quoted !== "none") {
      units.push({
        start: segment.start,
        end: segment.end,
        bare: null,
        text: segmentValue(word, segment),
      });
      continue;
    }
    for (let i = Math.max(segment.start, from); i < segment.end; i += 1) {
      const ch = word.raw[i - word.start] ?? "";
      units.push({ start: i, end: i + 1, bare: ch, text: ch });
    }
  }
  return units;
}

/**
 * Where the current alternative of the innermost brace group still open at
 * the end of `units` starts, or null when no group is open: then a brace is
 * an ordinary character of the value being typed.
 */
function openAlternative(units: readonly Unit[]): number | null {
  const stack: number[] = [];
  for (const unit of units) {
    if (unit.bare === "{") stack.push(unit.end);
    else if (unit.bare === "}") stack.pop();
    else if (unit.bare === "," && stack.length > 0) {
      stack[stack.length - 1] = unit.end;
    }
  }
  return stack.at(-1) ?? null;
}

const decode = (units: readonly Unit[], from: number): string =>
  units
    .filter((u) => u.start >= from)
    .map((u) => u.text)
    .join("");

/**
 * The rest of an alternative past the caret, so accepting `ui` in
 * `{web,u|i}` replaces `ui` rather than leaving an `i` behind. Only bare
 * characters count; a quote or a separator ends it.
 */
function alternativeTail(text: string, caret: number): number {
  const match = /^[^\s,{}'"\\]*/.exec(text.slice(caret));
  return caret + (match?.[0].length ?? 0);
}

/**
 * Plain mode: the units of a filter's values up to the caret. A quoted run
 * only opens where a value (or an alternative) starts, which is the only
 * place plain mode reads one; null when the caret is inside it.
 */
function plainUnits(query: string, from: number, caret: number): Unit[] | null {
  const units: Unit[] = [];
  let i = from;
  let valueStart = from;
  const stack: number[] = [];
  while (i < caret) {
    const ch = query[i] as string;
    if (ch === '"' && (i === valueStart || i === stack.at(-1))) {
      const close = query.indexOf('"', i + 1);
      if (close === -1 || close >= caret) return null;
      units.push({
        start: i,
        end: close + 1,
        bare: null,
        text: query.slice(i + 1, close),
      });
      i = close + 1;
      continue;
    }
    units.push({ start: i, end: i + 1, bare: ch, text: ch });
    if (ch === "{") stack.push(i + 1);
    else if (ch === "}") stack.pop();
    else if (ch === ",") {
      if (stack.length > 0) stack[stack.length - 1] = i + 1;
      else valueStart = i + 1;
    }
    i += 1;
  }
  return units;
}

function queryAlternative(
  schema: CompiledQuerySchema,
  query: string,
  part: Extract<QueryPart, { kind: "filter" }>,
  caret: number,
): { from: number; to: number; typed: string } | null {
  const valuesFrom = part.keyEnd + 1;
  let units: Unit[] | null;
  let open = false;
  if (schema.escapes === "shell") {
    const word = shellWords(query.slice(part.start, caret), part.start)[0];
    if (word === undefined) return null;
    units = unitsOf(word, valuesFrom);
    open = word.unclosed === true;
  } else {
    units = plainUnits(query, valuesFrom, caret);
  }
  if (units === null) return null;
  const from = openAlternative(units);
  if (from === null) return null;
  const to = open ? caret : alternativeTail(query, caret);
  return { from, to, typed: decode(units, from) + query.slice(caret, to) };
}

/**
 * The slot under the caret in a query: a value where the caret stands after
 * a known key's colon, else the bare word the caret stands in (or an empty
 * one where it stands) as a key. Null where a key cannot go at all: inside a
 * filter's key, and inside quotes, which is how one asks for a literal.
 */
export function queryCompletionSlot(
  schema: CompiledQuerySchema,
  parts: readonly QueryPart[],
  query: string,
  caret: number,
): CompletionSlot | null {
  for (const part of parts) {
    if (caret < part.start || caret > part.end) continue;
    if (part.kind === "filter") {
      const valuesFrom = part.keyEnd + 1;
      if (caret < valuesFrom) return null;
      const spec = schema.qualifiers[part.key]?.value;
      if (spec === undefined) return null;
      const group = schema.braces
        ? queryAlternative(schema, query, part, caret)
        : null;
      if (group !== null) {
        return { kind: "value", ...group, spec, key: part.key, inBraces: true };
      }
      // The value the caret is inside, or the empty one it is sitting at.
      const on = part.values.find((v) => caret >= v.start && caret <= v.end);
      return {
        kind: "value",
        from: on?.start ?? caret,
        to: on?.end ?? caret,
        typed: on?.value ?? "",
        spec,
        key: part.key,
        inBraces: false,
      };
    }
    if (part.kind === "text") {
      if (part.raw.startsWith('"')) return null;
      if (schema.escapes === "shell" && part.raw.startsWith("'")) return null;
      const text = query.slice(part.start, caret);
      const negated = text.startsWith("-");
      return {
        kind: "key",
        from: part.start,
        to: caret,
        typed: negated ? text.slice(1) : text,
        negated,
      };
    }
  }
  return { kind: "key", from: caret, to: caret, typed: "", negated: false };
}

const FIRST_LEVEL = /^\/([a-z0-9-]*)$/;
const ARGUMENT_LEVEL = /^\/([a-z0-9-]+)[ \t]/;

/**
 * The slot at the end of `lineBeforeCaret`: the command word itself, or the
 * argument the caret is in. Null where the line cannot be a command, past
 * the last argument, and for a command that takes none.
 */
export function commandCompletionSlot<T>(
  registry: CommandRegistry<T>,
  lineBeforeCaret: string,
): CompletionSlot | null {
  const line = lineBeforeCaret;
  const first = FIRST_LEVEL.exec(line);
  if (first !== null) {
    return {
      kind: "command",
      from: 0,
      to: line.length,
      typed: first[1] as string,
    };
  }
  const head = ARGUMENT_LEVEL.exec(line);
  if (head === null) return null;
  const command = registry.byName.get(head[1] as string);
  if (command === undefined || command.args.length === 0) return null;
  const nameEnd = (head[1] as string).length + 1;
  const caret = line.length;
  const words = shellWords(line.slice(nameEnd), nameEnd);
  // A word that ends before the caret is finished; the caret starts the next.
  if (words.length > 0 && (words.at(-1) as ShellWord).end < caret) {
    words.push(rawWord(line, caret));
  } else if (words.length === 0) {
    words.push(rawWord(line, caret));
  }

  const last = command.args.length - 1;
  let rest = false;
  const restHead = words[last];
  if (
    command.args[last]?.rest &&
    restHead !== undefined &&
    !/^['"]/.test(restHead.raw)
  ) {
    words.splice(last, words.length - last, rawWord(line, restHead.start));
    rest = true;
  }
  const index = words.length - 1;
  const spec = command.args[index];
  if (spec === undefined) return null;
  const word = words[index] as ShellWord;

  let from = word.start;
  let typed = word.value;
  let inBraces = false;
  if (spec.multiple) {
    const units = unitsOf(word, word.start);
    const alternative = openAlternative(units);
    if (alternative !== null) {
      from = alternative;
      typed = decode(units, alternative);
      inBraces = true;
    }
  }
  return {
    kind: "argument",
    from,
    to: caret,
    typed,
    spec: spec.value,
    command: command.name,
    index,
    last: index === last,
    optional: spec.optional === true,
    rest,
    inBraces,
  };
}

/**
 * The values a slot can take: the enum's set, the specials, and the
 * provider's snapshot, in that order. `"fetch"` tells the caller to ask a
 * `search` provider for `slot.typed` and call again with what it answered.
 */
export function slotValues(
  slot: ValueSlot,
  provider?: ValueProvider,
  fetched?: readonly ValueOption[],
): readonly ValueOption[] | "fetch" {
  const spec = slot.spec;
  const builtins: ValueOption[] = [
    ...(spec.kind === "enum" ? spec.values : []),
    ...(spec.special ?? []),
  ].map((value) => ({ value }));
  if (provider === undefined) return builtins;
  if ("search" in provider) {
    return fetched === undefined ? "fetch" : [...builtins, ...fetched];
  }
  return [...builtins, ...(provider.options ?? [])];
}

/** Options that `typed` prefixes, case-insensitively. */
export function filterOptions(
  options: readonly ValueOption[],
  typed: string,
): ValueOption[] {
  const lower = typed.toLowerCase();
  return options.filter((o) => o.value.toLowerCase().startsWith(lower));
}

/** Splice `text` over `[start, end)` and put the caret after it. */
export function splice(
  query: string,
  start: number,
  end: number,
  text: string,
): { value: string; caret: number } {
  return {
    value: query.slice(0, start) + text + query.slice(end),
    caret: start + text.length,
  };
}

/**
 * Splice, and leave the caret past a space, so that taking an offer ends a
 * word rather than parking the caret against the next one.
 *
 * Only values do this. A key is completed to its colon and the value comes
 * next with nothing in between, so a space there would have to be deleted
 * again.
 *
 * The cost, taken deliberately: a value can be a comma-separated list, and
 * closing it after one value means a second one needs a backspace. That is
 * the rare path; ending a word is every time.
 */
export function spliceThenSpace(
  query: string,
  start: number,
  end: number,
  text: string,
): { value: string; caret: number } {
  const spliced = splice(query, start, end, text);
  const after = spliced.value.slice(spliced.caret);
  return {
    value: /^\s/.test(after)
      ? spliced.value
      : `${spliced.value.slice(0, spliced.caret)} ${after}`,
    caret: spliced.caret + 1,
  };
}

/**
 * How a value is spelled into a command argument: as one shell word, except
 * in a rest argument's raw remainder, where quotes would be read literally.
 */
export function quoteArgument(
  slot: Extract<CompletionSlot, { kind: "argument" }>,
  value: string,
): string {
  return slot.rest ? value : quoteShellWord(value);
}

/**
 * Keys, offered against the word the caret is in. Only a non-empty prefix of
 * a real key counts as a match; a bare space lists them all, below submit.
 */
export function keyRows(
  schema: CompiledQuerySchema,
  query: string,
  slot: CompletionSlot | null,
): SourceResult<CompletionRow> {
  if (slot?.kind !== "key") return EMPTY;
  const typed = slot.typed.toLowerCase();
  if (typed.includes(":")) return EMPTY;
  const keys = schema.keys.filter((k) => k.toLowerCase().startsWith(typed));
  const minus = slot.negated ? "-" : "";
  return {
    matched: typed !== "" && keys.length > 0,
    rows: keys.map((key) => {
      const hint = schema.qualifiers[key]?.hint;
      return {
        id: `key:${key}`,
        text: `${minus}${key}:`,
        ...(hint === undefined ? {} : { hint }),
        icon: "key" as const,
        apply: splice(query, slot.from, slot.to, `${minus}${key}:`),
      };
    }),
  };
}

/**
 * Values, offered whenever the caret stands where one goes. The colon is
 * already typed by then, so the intent is not in doubt and this always counts
 * as a match — including on an empty value, where the whole list is what the
 * reader is asking for. `options` are offered as given; narrow them with
 * `filterOptions` first. Inside a brace group no space follows, since the
 * group is still open.
 */
export function valueRows(
  schema: CompiledQuerySchema,
  query: string,
  slot: CompletionSlot | null,
  options: readonly ValueOption[],
): SourceResult<CompletionRow> {
  if (slot?.kind !== "value") return EMPTY;
  return {
    matched: true,
    rows: options.map((o) => {
      const text = quoteQueryValue(schema, o.value);
      return {
        id: `value:${slot.key}:${o.value}`,
        text,
        ...(o.hint === undefined ? {} : { hint: o.hint }),
        icon: "value" as const,
        apply: slot.inBraces
          ? splice(query, slot.from, slot.to, text)
          : spliceThenSpace(query, slot.from, slot.to, text),
      };
    }),
  };
}

/**
 * The offered rows, in order: **the submit row is first** unless something
 * is genuinely being completed.
 *
 * The reader is typing a query, not filling in a form. Putting a completion
 * above the submit row means Enter submits something they did not ask for,
 * and the only evidence that they wanted one is that what they typed
 * actually prefixes something. Everything else — the full list of keys after
 * a space, say — is still shown, because that is how the syntax is
 * discovered, but it waits below.
 *
 * `limit` is spent here rather than inside each source, so that a source
 * added later lands in the same budget without having to remember one. The
 * matched rows spend it first — they are what the reader is completing — the
 * submit row is never spent, and whatever is left goes to the rest.
 *
 * A source marked `yields` waits for both of those to be served and takes
 * only the remainder. History is the one that does in todou (T-270): a
 * completion or a jump answers the string being typed right now, history
 * answers what was searched before, and the keys are the only place the
 * syntax can be discovered — so history is what gives way when the panel is
 * full.
 */
export function orderRows<Row>(
  results: readonly SourceResult<Row>[],
  submit: Row,
  limit = 20,
): Row[] {
  const band = (yields: boolean, matched: boolean) =>
    results
      .filter((r) => (r.yields ?? false) === yields && r.matched === matched)
      .flatMap((r) => r.rows);

  const firmMatched = band(false, true);
  const firmRest = band(false, false);
  const room = Math.max(0, limit - firmMatched.length - firmRest.length);
  const softMatched = band(true, true).slice(0, room);
  const softRest = band(true, false).slice(0, room - softMatched.length);

  const matched = [...firmMatched, ...softMatched].slice(0, limit);
  const rest = [...firmRest, ...softRest].slice(0, limit - matched.length);
  return [...matched, submit, ...rest];
}
