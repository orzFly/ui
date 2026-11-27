// No import.meta.glob here: scripts/data.ts reads this from Node, outside Vite.

// `../name.ts` from a demo's directory, `./name.ts` from a file beside it: a file directly in
// src/demos/. A path further out (`../../routes.ts`) is the site's.
const FROM_DEMO = /\bfrom\s+["']\.\.\/([\w.-]+\.tsx?)["']/g;
const FROM_SHARED = /\bfrom\s+["']\.\/([\w.-]+\.tsx?)["']/g;

const names = (source: string, pattern: RegExp) =>
  [...source.matchAll(pattern)].flatMap(([, name]) => (name ? [name] : []));

/**
 * The files directly in `src/demos/` that a demo's own `sources` import, and those these import
 * in turn, each once, in path order: code two demos share, such as `useHash`. `shared` holds
 * every file directly in `src/demos/` by name.
 */
export function sharedImports(
  sources: readonly string[],
  shared: Readonly<Record<string, string>>,
): string[] {
  const found = new Set<string>();
  const next = sources.flatMap((source) => names(source, FROM_DEMO));
  for (let name = next.pop(); name !== undefined; name = next.pop()) {
    const source = shared[name];
    if (source === undefined || found.has(name)) continue;
    found.add(name);
    next.push(...names(source, FROM_SHARED));
  }
  return [...found].sort();
}
