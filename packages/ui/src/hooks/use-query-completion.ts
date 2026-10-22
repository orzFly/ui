import {
  type CompiledQuerySchema,
  type CompletionRow,
  filterOptions,
  keyRows,
  parseQuery,
  providerOf,
  type QueryPart,
  queryCompletionSlot,
  type SourceResult,
  slotValues,
  type ValueOption,
  type ValueProvider,
  type ValueProviders,
  valueRows,
} from "@orz/query";
import { useEffect, useMemo, useRef, useState } from "react";

/** Quiet time before a `search` provider is asked, so typing is not a request per key. */
const FETCH_DELAY = 150;

/** What to ask a `search` provider for, when the slot needs one. */
type Wanted = { cacheKey: string; source: string; typed: string } | null;

/**
 * The completions for the caret in a query: keys while a word is typed,
 * values after a known key's colon.
 *
 * Snapshot providers answer at once. A `search` provider is asked for the
 * typed prefix after 150 ms of quiet; a newer prefix aborts the request in
 * flight, and answers are kept per source and prefix for the life of the
 * component, so backspacing over a prefix asks nothing again. A rejected
 * search leaves only the values the schema itself knows: the box has to keep
 * working without completions, and nothing about it is the reader's to fix.
 *
 * With `enabled: false` nothing is offered and nothing is fetched; `parts`
 * are still parsed, since the highlighting needs them either way.
 */
export function useQueryCompletion({
  schema,
  value,
  caret,
  providers,
  enabled = true,
}: {
  schema: CompiledQuerySchema;
  value: string;
  caret: number;
  providers: ValueProviders;
  enabled?: boolean;
}): {
  parts: QueryPart[];
  completions: SourceResult<CompletionRow>[];
  loading: boolean;
} {
  const parts = useMemo(() => parseQuery(schema, value), [schema, value]);
  const slot = useMemo(
    () => (enabled ? queryCompletionSlot(schema, parts, value, caret) : null),
    [enabled, schema, parts, value, caret],
  );

  const cache = useRef(new Map<string, readonly ValueOption[]>());
  const [failed, setFailed] = useState<string | null>(null);
  const [, setAnswered] = useState(0);

  let provider: ValueProvider | undefined;
  let wanted: Wanted = null;
  if (slot?.kind === "value") {
    provider = providerOf(slot.spec, providers);
    const source = slot.spec.kind === "enum" ? undefined : slot.spec.source;
    if (
      provider !== undefined &&
      "search" in provider &&
      source !== undefined
    ) {
      wanted = {
        cacheKey: `${source}\u0000${slot.typed}`,
        source,
        typed: slot.typed,
      };
    }
  }

  // The effect reads the provider through a ref: an app that rebuilds its
  // providers object on every render would otherwise restart the quiet
  // period on every render and never get to ask.
  const latest = useRef(providers);
  latest.current = providers;
  const cacheKey = wanted?.cacheKey;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `cacheKey` stands for `wanted`, which is rebuilt every render
  useEffect(() => {
    if (wanted === null || cache.current.has(wanted.cacheKey)) return;
    const { cacheKey: key, source, typed } = wanted;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const current = latest.current[source];
      if (current === undefined || !("search" in current)) return;
      current.search(typed, controller.signal).then(
        (answer) => {
          if (controller.signal.aborted) return;
          cache.current.set(key, answer);
          setAnswered((n) => n + 1);
        },
        () => {
          if (controller.signal.aborted) return;
          setFailed(key);
        },
      );
    }, FETCH_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cacheKey]);

  const completions: SourceResult<CompletionRow>[] = [];
  let loading = false;
  if (slot !== null) {
    completions.push(keyRows(schema, value, slot));
    if (slot.kind === "value") {
      const options = slotValues(slot, provider);
      if (options !== "fetch") {
        completions.push(
          valueRows(schema, value, slot, filterOptions(options, slot.typed)),
        );
      } else {
        // The schema's own values (an enum's set, the specials) need no
        // request, so they are offered first and at once; the provider's
        // answer follows as it was given, already matched to the prefix.
        const builtins = slotValues(slot);
        const known = builtins === "fetch" ? [] : builtins;
        const fetched =
          wanted === null ? undefined : cache.current.get(wanted.cacheKey);
        loading = fetched === undefined && failed !== wanted?.cacheKey;
        completions.push(
          valueRows(schema, value, slot, [
            ...filterOptions(known, slot.typed),
            ...(fetched ?? []),
          ]),
        );
      }
    }
  }
  return { parts, completions, loading };
}
