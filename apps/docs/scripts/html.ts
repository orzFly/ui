/** What the server entry hands back for one URL. */
export interface RenderedPage {
  status: 200 | 404;
  head: string;
  html: string;
}

/** Puts a rendered page into index.html's `<!--head-->` and `<!--app-->` slots. */
export function fillTemplate(template: string, page: RenderedPage): string {
  for (const slot of ["<!--head-->", "<!--app-->"]) {
    if (!template.includes(slot)) throw new Error(`index.html lacks ${slot}`);
  }
  // A function replacer, so a `$&` in the page is not read as a pattern.
  return template
    .replace("<!--head-->", () => page.head)
    .replace("<!--app-->", () => page.html);
}
