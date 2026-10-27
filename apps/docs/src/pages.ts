import type { PageMeta, PageModule } from "./page.ts";
import { buildNav, routeOf } from "./routes.ts";

const metas = import.meta.glob<PageMeta>("./content/**/*.mdx", {
  query: "?meta",
  import: "meta",
  eager: true,
});
const loaders = import.meta.glob<PageModule>("./content/**/*.mdx");

export const pages = Object.entries(metas).map(([file, meta]) => ({
  file,
  route: routeOf(file),
  meta,
}));

export const nav = buildNav(pages);

const loaderOf = new Map(
  Object.entries(loaders).map(([file, load]) => [routeOf(file), load]),
);
const loaded = new Map<string, PageModule>();

/** Whether a route has a page. */
export const hasPage = (route: string) => loaderOf.has(route);

/** Fetches a route's page module; null for a route with no page. */
export async function loadPage(route: string): Promise<PageModule | null> {
  const cached = loaded.get(route);
  if (cached) return cached;
  const load = loaderOf.get(route);
  if (!load) return null;
  const page = await load();
  loaded.set(route, page);
  return page;
}

/** A page module loadPage has already fetched, for rendering without a wait. */
export const loadedPage = (route: string) => loaded.get(route);
