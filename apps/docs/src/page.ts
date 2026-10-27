import type { ComponentType } from "react";

/** What every page under content/ exports as `meta`. */
export interface PageMeta {
  title: string;
  /** The lead under the title, the `<meta name="description">`, and the card text on a parent page. */
  description?: string;
  /** Position among its siblings in the nav, ascending; unordered pages follow, by title. */
  order?: number;
  /** Storybook titles of the components the page is about (`ui/Primitives/Switch`), linked under API. */
  api?: string[];
  /** "bare": no title block, sidebar or contents list; the page lays itself out (Home). */
  layout?: "bare";
}

/** An entry of a page's "On this page" list: its `##` and `###` headings. */
export interface TocEntry {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface PageModule {
  default: ComponentType<{ components?: Record<string, unknown> }>;
  meta: PageMeta;
  toc: TocEntry[];
}
