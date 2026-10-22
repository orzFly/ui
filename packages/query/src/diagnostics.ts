import type { CompiledQuerySchema, QueryPart } from "./query.ts";
import { didYouMean } from "./suggest.ts";
import {
  providerOf,
  suggestionCandidates,
  type ValueProviders,
  valueVerdict,
} from "./values.ts";

export type QueryDiagnostic = {
  key: string;
  value: string;
  start: number;
  end: number;
  /** `"opne" is not a state (open, closed)` */
  message: string;
  suggestion: string | null;
};

const article = (word: string): string =>
  /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;

/**
 * What a query gets wrong that this package can tell without the app:
 * enum values outside their set, `named` values an `options` provider does
 * not hold, failed brace expansions and too many qualifiers. A value whose
 * verdict is `unknown` is never reported; the app's server, which can see
 * its own rows, stays the authority for those.
 */
export function diagnoseQuery(
  schema: CompiledQuerySchema,
  parts: readonly QueryPart[],
  providers?: ValueProviders,
): QueryDiagnostic[] {
  const diagnostics: QueryDiagnostic[] = [];
  let filters = 0;
  for (const part of parts) {
    if (part.kind !== "filter") continue;
    filters += 1;
    if (schema.maxFilters !== undefined && filters === schema.maxFilters + 1) {
      const count = parts.filter((p) => p.kind === "filter").length;
      diagnostics.push({
        key: part.key,
        value: part.raw,
        start: part.start,
        end: part.end,
        message: `${count} qualifiers (at most ${schema.maxFilters})`,
        suggestion: null,
      });
    }
    const spec = schema.qualifiers[part.key]?.value;
    if (spec === undefined) continue;
    const provider = providerOf(spec, providers);
    for (const value of part.values) {
      const where = { key: part.key, start: value.start, end: value.end };
      if (value.error !== undefined) {
        diagnostics.push({
          ...where,
          value: value.value,
          message: `"${value.value}" ${value.error}`,
          suggestion: null,
        });
        continue;
      }
      for (const each of value.expanded) {
        if (each === "") continue;
        if (valueVerdict(spec, each, provider) !== "invalid") continue;
        const message =
          spec.kind === "enum"
            ? `"${each}" is not ${article(part.key)} (${spec.values.join(", ")})`
            : `no ${part.key} named "${each}"`;
        diagnostics.push({
          ...where,
          value: each,
          message,
          suggestion: didYouMean(each, suggestionCandidates(spec, provider)),
        });
      }
    }
  }
  return diagnostics;
}
