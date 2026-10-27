import { useEffect, useState } from "react";
import { routeFromPathname } from "./routes.ts";

// router.tsx has the same value, but importing it would pull every page in
// (pages.ts), which a unit test of these helpers cannot load.
const BASE = import.meta.env.BASE_URL;

/** The part of pagefind.js the site calls. */
interface Pagefind {
  options(options: { baseUrl: string }): Promise<void>;
  search(query: string): Promise<{
    results: { id: string; data: () => Promise<PagefindData> }[];
  }>;
}

interface PagefindData {
  url: string;
  meta: { title?: string };
  excerpt: string;
  sub_results: { title: string; url: string; excerpt: string }[];
}

/** A stretch of an excerpt; `match` is what Pagefind marked as the hit. */
export interface ExcerptPart {
  text: string;
  match: boolean;
}

export interface SearchSection {
  title: string;
  route: string;
  hash: string;
  excerpt: ExcerptPart[];
}

export interface SearchHit {
  route: string;
  title: string;
  excerpt: ExcerptPart[];
  /** The headings under which the page matched, past the page's own top. */
  sections: SearchSection[];
}

export interface SearchState {
  status: "idle" | "loading" | "done" | "error";
  hits: SearchHit[];
}

const MAX_HITS = 8;
const MAX_SECTIONS = 3;
const DEBOUNCE_MS = 120;

let pagefind: Promise<Pagefind> | undefined;

/**
 * The index the build writes next to the pages; in dev the server answers
 * for it. Loaded on the first query, so a reader who never searches never
 * fetches it.
 */
function loadPagefind(): Promise<Pagefind> {
  pagefind ??= (
    import(
      /* @vite-ignore */ `${BASE}pagefind/pagefind.js`
    ) as Promise<Pagefind>
  ).then(async (module) => {
    // The index holds routes; this puts the base in front of each URL it
    // hands back. Pagefind would guess the same from its own URL.
    await module.options({ baseUrl: BASE });
    return module;
  });
  // A failed load (offline, no index in this build) is retried on the next query.
  pagefind.catch(() => {
    pagefind = undefined;
  });
  return pagefind;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
};

/**
 * Pagefind's excerpt is escaped text with `<mark>` around the hits. Split
 * there and unescaped, it renders as text, never as markup.
 */
export function excerptParts(excerpt: string): ExcerptPart[] {
  return excerpt
    .split(/(<mark>[\s\S]*?<\/mark>)/)
    .filter(Boolean)
    .map((part) => {
      const match = part.startsWith("<mark>");
      const text = (match ? part.slice(6, -7) : part).replace(
        /&(?:amp|lt|gt|quot|#39|#x27);/g,
        (entity) => ENTITIES[entity] ?? entity,
      );
      return { text, match };
    });
}

/** A URL Pagefind indexed (base included) as the route and hash the router takes. */
export function locationOf(url: string): { route: string; hash: string } {
  const at = url.indexOf("#");
  const path = at < 0 ? url : url.slice(0, at);
  return {
    route: routeFromPathname(path, BASE),
    hash: at < 0 ? "" : url.slice(at),
  };
}

export function hitOf(data: PagefindData): SearchHit {
  const { route } = locationOf(data.url);
  return {
    route,
    title: data.meta.title ?? route,
    excerpt: excerptParts(data.excerpt),
    sections: data.sub_results
      // The first sub-result is the page from its top, already the hit itself.
      .filter((sub) => sub.url.includes("#"))
      .slice(0, MAX_SECTIONS)
      .map((sub) => ({
        title: sub.title,
        ...locationOf(sub.url),
        excerpt: excerptParts(sub.excerpt),
      })),
  };
}

/** The pages that match `query`, searched as the reader stops typing. */
export function useSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({
    status: "idle",
    hits: [],
  });
  useEffect(() => {
    const terms = query.trim();
    if (terms === "") {
      setState({ status: "idle", hits: [] });
      return;
    }
    let current = true;
    // Earlier hits stay up while the next ones load, so the list does not flash.
    setState((previous) => ({ status: "loading", hits: previous.hits }));
    const timer = setTimeout(async () => {
      try {
        const { results } = await (await loadPagefind()).search(terms);
        const data = await Promise.all(
          results.slice(0, MAX_HITS).map((result) => result.data()),
        );
        if (current) setState({ status: "done", hits: data.map(hitOf) });
      } catch {
        if (current) setState({ status: "error", hits: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  return state;
}
