import * as pagefind from "pagefind";

/** A prerendered page and its route. */
export interface IndexedPage {
  route: string;
  html: string;
}

/**
 * A Pagefind index of the pages. Only what a page marks
 * `data-pagefind-body` is indexed, so the nav and the 404 page stay out.
 * Pages go in by route, base left off: Pagefind's script puts the base it
 * is loaded from in front of every URL it hands back.
 */
export async function searchIndex(pages: Iterable<IndexedPage>) {
  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(`pagefind: ${errors.join("; ")}`);
  for (const { route, html } of pages) {
    const added = await index.addHTMLFile({ url: route, content: html });
    if (added.errors.length > 0) {
      throw new Error(`pagefind: ${route}: ${added.errors.join("; ")}`);
    }
  }
  return index;
}

/** Pagefind runs as a child process; a build that has written its index lets it go. */
export const closeSearch = () => pagefind.close();
