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

/** The demos that name `route` among their guidelines, each with where to see it, in nav order. */
export function demosShowing(route: string) {
  return pages
    .flatMap(({ route: demo, meta }) =>
      (meta.guidelines ?? [])
        .filter((guideline) => guideline.route === route)
        .map(({ where }) => ({ route: demo, meta, where })),
    )
    .sort(
      (a, b) =>
        (a.meta.order ?? Number.POSITIVE_INFINITY) -
        (b.meta.order ?? Number.POSITIVE_INFINITY),
    );
}

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
