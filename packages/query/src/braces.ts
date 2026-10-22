/**
 * Brace expansion, bash's comma form: `{a,b}` → `a`, `b`; adjacent text
 * distributes; groups multiply left to right and nest. Text that merely
 * contains braces is not changed: a group needs an unquoted comma at its own
 * level, so `{}`, `{a}` and an unclosed `{` stay literal. Sequence
 * expressions (`{1..5}`) are not supported and stay literal too.
 */

import { type ShellWord, segmentValue } from "./shell-words.ts";

export type BraceExpansion =
  | { ok: true; words: string[] }
  | { ok: false; reason: string };

/** Fail rather than cut, the way a query with too many terms is rejected. */
export const BRACE_LIMIT = 64;

/** One character; only an active one can group or separate. */
export type BraceChar = { ch: string; active: boolean };
type Char = BraceChar;
type Item = string | { alternatives: Item[][] };

/** Quoted and escaped characters are literal; only bare ones can group. */
function charsOf(word: ShellWord | string): Char[] {
  if (typeof word === "string") {
    return Array.from(word, (ch) => ({ ch, active: true }));
  }
  const chars: Char[] = [];
  for (const segment of word.segments) {
    const active = segment.quoted === "none";
    for (const ch of segmentValue(word, segment)) chars.push({ ch, active });
  }
  return chars;
}

const isActive = (chars: Char[], i: number, ch: string): boolean =>
  chars[i]?.active === true && chars[i]?.ch === ch;

/**
 * Pairs each bare `{` with its `}`, then keeps the pairs that have a bare
 * comma at their own level. Returns open index → close index, plus the
 * own-level commas of each group.
 */
function findGroups(
  chars: Char[],
): Map<number, { close: number; commas: number[] }> {
  const pairs: { open: number; close: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    if (isActive(chars, i, "{")) stack.push(i);
    else if (isActive(chars, i, "}") && stack.length > 0) {
      pairs.push({ open: stack.pop() as number, close: i });
    }
  }
  const closeOf = new Map(pairs.map((p) => [p.open, p.close]));
  const groups = new Map<number, { close: number; commas: number[] }>();
  for (const { open, close } of pairs) {
    const commas: number[] = [];
    for (let i = open + 1; i < close; i += 1) {
      const nested = closeOf.get(i);
      if (nested !== undefined) {
        i = nested;
        continue;
      }
      if (isActive(chars, i, ",")) commas.push(i);
    }
    if (commas.length > 0) groups.set(open, { close, commas });
  }
  return groups;
}

class OverLimit extends Error {}

/**
 * Every kept group has at least two alternatives, so nesting deeper than the
 * limit already expands past it; failing here keeps the recursion shallow.
 * The 256 cap protects the stack from a large custom limit.
 */
function parse(
  chars: Char[],
  groups: Map<number, { close: number; commas: number[] }>,
  from: number,
  to: number,
  depth: number,
  limit: number,
): Item[] {
  if (depth > Math.min(limit, 256)) throw new OverLimit();
  const items: Item[] = [];
  let text = "";
  for (let i = from; i < to; i += 1) {
    const group = groups.get(i);
    if (group === undefined) {
      text += (chars[i] as Char).ch;
      continue;
    }
    if (text !== "") items.push(text);
    text = "";
    const bounds = [i, ...group.commas, group.close];
    const alternatives: Item[][] = [];
    for (let b = 0; b + 1 < bounds.length; b += 1) {
      alternatives.push(
        parse(
          chars,
          groups,
          (bounds[b] as number) + 1,
          bounds[b + 1] as number,
          depth + 1,
          limit,
        ),
      );
    }
    items.push({ alternatives });
    i = group.close;
  }
  if (text !== "") items.push(text);
  return items;
}

function expand(items: Item[], limit: number): string[] {
  let words = [""];
  for (const item of items) {
    if (typeof item === "string") {
      words = words.map((w) => w + item);
      continue;
    }
    const tails = item.alternatives.flatMap((alt) => expand(alt, limit));
    if (tails.length > limit || words.length * tails.length > limit) {
      throw new OverLimit();
    }
    // Prefix-major, which is bash's order: `{a,b}{c,d}` → ac ad bc bd.
    words = words.flatMap((w) => tails.map((t) => w + t));
  }
  return words;
}

/** A plain string is treated as entirely unquoted. */
export function expandBraces(
  word: ShellWord | string,
  options?: { limit?: number },
): BraceExpansion {
  return expandBraceChars(charsOf(word), options?.limit ?? BRACE_LIMIT);
}

/**
 * For readings that are not shell words, such as plain mode's quoted
 * alternatives, whose quotes carry no escapes.
 */
export function expandBraceChars(
  chars: BraceChar[],
  limit: number,
): BraceExpansion {
  const groups = findGroups(chars);
  try {
    const items = parse(chars, groups, 0, chars.length, 0, limit);
    return { ok: true, words: expand(items, limit) };
  } catch (error) {
    if (!(error instanceof OverLimit)) throw error;
    return { ok: false, reason: `expands to more than ${limit} values` };
  }
}
