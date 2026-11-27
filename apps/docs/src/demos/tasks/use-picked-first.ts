import { useState } from "react";

interface Sorted {
  open: boolean;
  query: string;
  all: readonly string[];
  first: ReadonlySet<string>;
}

/**
 * `all`, what `picked` holds first, each part in `all`'s order. Sorted again only as the menu
 * opens, as its query changes and as `all` does, never as a row is picked: a row that moved
 * under the pointer would take the next click meant for another.
 */
export function usePickedFirst(
  all: readonly string[],
  picked: readonly string[],
  open: boolean,
  query: string,
): string[] {
  const [sorted, setSorted] = useState<Sorted>(() => ({
    open,
    query,
    all,
    first: new Set(picked),
  }));
  let first = sorted.first;
  if (sorted.open !== open || sorted.query !== query || sorted.all !== all) {
    first = new Set(picked);
    setSorted({ open, query, all, first });
  }
  return [
    ...all.filter((each) => first.has(each)),
    ...all.filter((each) => !first.has(each)),
  ];
}
