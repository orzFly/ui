import type { PageMeta } from "./page.ts";

/**
 * A page's URL from its file under content/, base left off:
 * `./content/guidelines/patterns/forms.mdx` is `/guidelines/patterns/forms/`,
 * and an `index.mdx` is its directory's.
 */
export function routeOf(file: string): string {
  const path = file
    .replace(/^.*?\/content\//, "")
    .replace(/\.mdx$/, "")
    .replace(/(?:^|\/)index$/, "");
  return path === "" ? "/" : `/${path}/`;
}

/** A pathname the browser asked for, as a route: the base taken off, the trailing slash put on. */
export function routeFromPathname(pathname: string, base: string): string {
  if (`${pathname}/` === base) return "/";
  const path = pathname.startsWith(base)
    ? pathname.slice(base.length - 1)
    : pathname;
  const clean = path.replace(/\/index\.html$/, "/");
  return clean.endsWith("/") ? clean : `${clean}/`;
}

/** A route as an href under the base. */
export function hrefOf(route: string, base: string): string {
  return base + route.slice(1);
}

/** Storybook's id for a title, by its own `sanitize`. */
export function storyId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** The Storybook copy under the site, or one docs page in it. */
export function storybookHref(base: string, title?: string): string {
  const root = `${base}storybook/`;
  return title === undefined
    ? root
    : `${root}?path=/docs/${storyId(title)}--docs`;
}

export interface NavNode {
  route: string;
  title: string;
  description?: string;
  order: number;
  /** False for a directory with no index.mdx: a heading in the nav, not a link. */
  page: boolean;
  children: NavNode[];
}

const humanize = (segment: string) =>
  segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

function sortTree(node: NavNode) {
  for (const child of node.children) sortTree(child);
  node.children.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title),
  );
  // A directory without a page of its own goes where its first page does.
  if (!node.page && node.children.length > 0) {
    node.order = Math.min(...node.children.map((child) => child.order));
  }
}

/** The nav tree, from the pages' routes and meta; the root is Home. */
export function buildNav(
  pages: readonly { route: string; meta: PageMeta }[],
): NavNode {
  const root: NavNode = {
    route: "/",
    title: "Home",
    order: 0,
    page: false,
    children: [],
  };
  const nodes = new Map<string, NavNode>([["/", root]]);
  const nodeAt = (route: string): NavNode => {
    const existing = nodes.get(route);
    if (existing) return existing;
    const segments = route.split("/").filter(Boolean);
    const node: NavNode = {
      route,
      title: humanize(segments.at(-1) ?? ""),
      order: Number.POSITIVE_INFINITY,
      page: false,
      children: [],
    };
    nodes.set(route, node);
    const parent = `/${segments.slice(0, -1).join("/")}${segments.length > 1 ? "/" : ""}`;
    nodeAt(parent).children.push(node);
    return node;
  };
  for (const { route, meta } of pages) {
    if (meta.nav === false) continue;
    const node = nodeAt(route);
    node.page = true;
    node.title = meta.title;
    node.description = meta.description;
    node.order = meta.order ?? Number.POSITIVE_INFINITY;
  }
  sortTree(root);
  return root;
}

/** The nodes from the root down to the route's, both ends included; empty for an unknown route. */
export function trail(root: NavNode, route: string): NavNode[] {
  if (root.route === route) return [root];
  for (const child of root.children) {
    if (route.startsWith(child.route)) {
      const rest = trail(child, route);
      if (rest.length > 0) return [root, ...rest];
    }
  }
  return [];
}

/** A subtree's pages in reading order, for previous and next. */
export function pagesIn(node: NavNode): NavNode[] {
  return [
    ...(node.page ? [node] : []),
    ...node.children.flatMap((child) => pagesIn(child)),
  ];
}
