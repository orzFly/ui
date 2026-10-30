import {
  type CompiledQuerySchema,
  providerOf,
  type QueryPart,
  type QueryValue,
  type ShellWord,
  shellWords,
  type ValueProviders,
  type ValueVerdict,
  valueVerdict,
  worstVerdict,
} from "@orz/query";
import type { ReactNode } from "react";

/**
 * Every span carries colour and nothing else — no `padding`, no `margin`, no
 * `border`. This markup is painted behind a transparent input and has to
 * measure identically to the input's own text; anything that adds width slides
 * the caret off the character it is standing on. It is also why a qualifier
 * cannot be a rounded chip here, and why GitHub's own measures at `padding: 0`.
 */
const KEY_CLASS = "text-primary";
const PUNCT_CLASS = "text-muted-foreground";
const VALUE_CLASS: Record<ValueVerdict, string> = {
  valid: "text-foreground bg-primary/12 rounded-[min(var(--radius-item),3px)]",
  special:
    "text-foreground bg-violet-500/15 rounded-[min(var(--radius-item),3px)]",
  invalid: "text-warning underline decoration-wavy",
  unknown:
    "text-foreground bg-primary/12 rounded-[min(var(--radius-item),3px)]",
};

type Filter = Extract<QueryPart, { kind: "filter" }>;

/**
 * One verdict for the whole value: a brace group paints as its worst
 * expansion, so one bad alternative is not hidden by its good neighbours.
 * Empty alternatives (`{,a}`) are skipped, as the server never sees them.
 */
function verdictOf(
  schema: CompiledQuerySchema,
  key: string,
  value: QueryValue,
  providers: ValueProviders,
): ValueVerdict {
  if (value.error !== undefined) return "invalid";
  const spec = schema.qualifiers[key]?.value;
  if (spec === undefined) return "valid";
  const provider = providerOf(spec, providers);
  const verdicts = value.expanded
    .filter((v) => v !== "")
    .map((v) => valueVerdict(spec, v, provider));
  return worstVerdict(verdicts) ?? "valid";
}

/** Offsets of the quotes and backslashes a shell word spends on quoting. */
function quotingOffsets(word: ShellWord, raw: string): Set<number> {
  const at = new Set<number>();
  const char = (i: number) => raw[i - word.start];
  for (const segment of word.segments) {
    if (segment.quoted === "escape") {
      at.add(segment.start);
    } else if (segment.quoted === "single") {
      at.add(segment.start);
      if (segment.end - segment.start > 1 && char(segment.end - 1) === "'") {
        at.add(segment.end - 1);
      }
    } else if (segment.quoted === "double") {
      at.add(segment.start);
      for (let i = segment.start + 1; i < segment.end; i += 1) {
        const c = char(i);
        if (c === "\\" && (char(i + 1) === '"' || char(i + 1) === "\\")) {
          at.add(i);
          i += 1;
        } else if (c === '"') {
          at.add(i);
        }
      }
    }
  }
  return at;
}

/**
 * A shell-mode value's own characters, with its quoting muted like the rest
 * of the punctuation. These sit inside the value's span, so the background
 * and underline still run under the whole value.
 */
function shellValueChildren(raw: string, value: QueryValue): ReactNode {
  const word = shellWords(value.raw, value.start)[0];
  if (word === undefined) return value.raw;
  const punct = quotingOffsets(word, value.raw);
  if (punct.size === 0) return value.raw;
  const out: ReactNode[] = [];
  let at = value.start;
  while (at < value.end) {
    const muted = punct.has(at);
    let end = at + 1;
    while (end < value.end && punct.has(end) === muted) end += 1;
    out.push(
      <span key={at} className={muted ? PUNCT_CLASS : undefined}>
        {raw.slice(at, end)}
      </span>,
    );
    at = end;
  }
  return out;
}

function valueSpans(
  part: Filter,
  raw: string,
  schema: CompiledQuerySchema,
  providers: ValueProviders,
): ReactNode[] {
  const out: ReactNode[] = [];
  // The head is `-?key:`; the tail after the last value is whatever commas
  // and half-typed characters follow it. Walking offsets rather than
  // re-joining is what keeps this a faithful copy of the input's own text.
  let at = part.start;
  const push = (
    end: number,
    className?: string,
    key?: string,
    children?: ReactNode,
  ) => {
    if (end <= at) return;
    out.push(
      <span key={key ?? `t${at}`} className={className}>
        {children ?? raw.slice(at, end)}
      </span>,
    );
    at = end;
  };
  push(part.keyStart, PUNCT_CLASS, `neg${part.start}`);
  push(part.keyEnd, KEY_CLASS, `key${part.start}`);
  for (const value of part.values) {
    push(value.start, PUNCT_CLASS, `sep${value.start}`);
    push(
      value.end,
      VALUE_CLASS[verdictOf(schema, part.key, value, providers)],
      `val${value.start}`,
      schema.escapes === "shell" ? shellValueChildren(raw, value) : undefined,
    );
  }
  push(part.end, PUNCT_CLASS, `tail${part.start}`);
  return out;
}

/**
 * The parsed query as spans, for the mirror layer behind the input. A pure
 * function of the parts, so it is the same string the input holds — never a
 * re-tokenization that could disagree with it.
 *
 * Values are coloured by their verdict against `providers`. A provider that
 * has not loaded yet leaves its values `unknown`, which paints as valid:
 * flashing every value amber and back as the list arrives is worse than
 * being briefly quiet.
 */
export function highlightQuery(
  text: string,
  parts: readonly QueryPart[],
  schema: CompiledQuerySchema,
  providers: ValueProviders = {},
): ReactNode[] {
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (part.kind === "filter") {
      out.push(...valueSpans(part, text, schema, providers));
    } else {
      out.push(
        <span key={`p${part.start}`}>{text.slice(part.start, part.end)}</span>,
      );
    }
  }
  return out;
}
