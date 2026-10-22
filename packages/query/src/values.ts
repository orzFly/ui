/**
 * Value specs: the one vocabulary for a qualifier value and a command
 * argument. Both are a word whose acceptable spellings come from somewhere,
 * and there are three somewheres:
 *
 * - `enum` — a closed set the schema knows, so a wrong value is detectable
 *   here and worth a diagnostic.
 * - `named` — names the app resolves (labels, statuses, members). The schema
 *   is static data that a server can share; the names live in the app's
 *   database and arrive through a provider at the point of use.
 * - `free` — matched literally, with no set to check it against.
 */

export type ValueSpec =
  | {
      kind: "enum";
      /** Canonical values, in the order help text lists them. */
      values: readonly string[];
      /** Extra spelling → canonical value; keys are lowercase. */
      aliases?: Readonly<Record<string, string>>;
      /** Values meaning something of their own: `@me`, `none`. */
      special?: readonly string[];
      hint?: string;
    }
  | {
      kind: "named";
      /** Which provider answers for it. */
      source: string;
      special?: readonly string[];
      hint?: string;
    }
  | {
      kind: "free";
      /** An optional provider, consulted for completion only. */
      source?: string;
      special?: readonly string[];
      hint?: string;
    };

export type ValueOption = { value: string; hint?: string };

export type ValueProvider =
  /** Everything at once. `undefined` while it loads. */
  | { options: readonly ValueOption[] | undefined }
  /** Too many to list: asked per prefix. */
  | {
      search: (
        prefix: string,
        signal: AbortSignal,
      ) => Promise<readonly ValueOption[]>;
    };

export type ValueProviders = Readonly<Record<string, ValueProvider>>;

/**
 * How a value paints and whether a command line is broken. `unknown` paints
 * like `valid`: flashing every value amber while a list loads and back is
 * worse than being briefly quiet.
 */
export type ValueVerdict = "valid" | "special" | "invalid" | "unknown";

/** The special spelling as the spec writes it, matched case-insensitively. */
export function specialValue(spec: ValueSpec, value: string): string | null {
  const lower = value.toLowerCase();
  return spec.special?.find((s) => s.toLowerCase() === lower) ?? null;
}

/** An enum value's canonical spelling; null for anything else. */
export function canonicalValue(spec: ValueSpec, value: string): string | null {
  if (spec.kind !== "enum") return null;
  const lower = value.toLowerCase();
  const canonical = spec.values.find((v) => v.toLowerCase() === lower);
  if (canonical !== undefined) return canonical;
  return spec.aliases?.[lower] ?? null;
}

/**
 * Never fetches: a `search` provider cannot answer synchronously, so it is
 * used for completion only and its values read as `unknown`.
 */
export function valueVerdict(
  spec: ValueSpec,
  value: string,
  provider?: ValueProvider,
): ValueVerdict {
  if (specialValue(spec, value) !== null) return "special";
  switch (spec.kind) {
    case "enum":
      return canonicalValue(spec, value) === null ? "invalid" : "valid";
    case "named": {
      if (provider === undefined || !("options" in provider)) return "unknown";
      if (provider.options === undefined) return "unknown";
      const lower = value.toLowerCase();
      return provider.options.some((o) => o.value.toLowerCase() === lower)
        ? "valid"
        : "invalid";
    }
    case "free":
      return "valid";
  }
}

const VERDICT_RANK: Record<ValueVerdict, number> = {
  valid: 0,
  unknown: 1,
  special: 2,
  invalid: 3,
};

/** One verdict for a list of values, as a brace expansion paints. */
export function worstVerdict(
  verdicts: readonly ValueVerdict[],
): ValueVerdict | null {
  let worst: ValueVerdict | null = null;
  for (const verdict of verdicts) {
    if (worst === null || VERDICT_RANK[verdict] > VERDICT_RANK[worst]) {
      worst = verdict;
    }
  }
  return worst;
}

/** The provider a spec reads from; an enum never has one. */
export function providerOf(
  spec: ValueSpec,
  providers?: ValueProviders,
): ValueProvider | undefined {
  if (spec.kind === "enum" || spec.source === undefined) return undefined;
  return providers?.[spec.source];
}

/** What a did-you-mean may suggest: only spellings that would be accepted. */
export function suggestionCandidates(
  spec: ValueSpec,
  provider?: ValueProvider,
): string[] {
  const special = spec.special ?? [];
  switch (spec.kind) {
    case "enum":
      return [...spec.values, ...Object.keys(spec.aliases ?? {}), ...special];
    case "named": {
      const options =
        provider !== undefined && "options" in provider ? provider.options : [];
      return [...(options ?? []).map((o) => o.value), ...special];
    }
    case "free":
      return [...special];
  }
}
