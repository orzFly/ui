import type { ComponentType } from "react";

/** What every page under content/ exports as `meta`. */
export interface PageMeta {
  title: string;
  /** The lead under the title, the `<meta name="description">`, and the card text on a parent page. */
  description?: string;
  /** Position among its siblings in the nav, ascending; unordered pages follow, by title. */
  order?: number;
  /**
   * Storybook titles of the components the page is about (`ui/Primitives/Switch`), linked under
   * API. A demo sets none: its About panel lists what its files import (`virtual:orz-demo-api`).
   */
  api?: string[];
  /** "bare": no title block, sidebar or contents list; the page lays itself out (Home). */
  layout?: "bare";
  /** false: kept out of the nav, reached by a control of its own (Settings, from the header). */
  nav?: false;
  /**
   * A demo's: the guidelines it puts into practice. Its About panel lists them, and each guideline
   * page lists the demos that name it, so the link is written once, here.
   */
  guidelines?: DemoGuideline[];
}

/** A guideline a demo puts into practice, and where in the demo to see it. */
export interface DemoGuideline {
  /** The guideline page's route, from the site root (`/guidelines/patterns/overlays/`). */
  route: string;
  /** What to do in the demo to see the guideline at work, as one sentence. */
  where: string;
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
