/**
 * Where a link written for Storybook when it sat at the site root
 * (`…/ui/?path=/docs/ui-primitives-switch--docs`) lives now, or null when
 * the URL is not one. Self-contained: the page inlines its source.
 */
export function storybookRedirect(
  search: string,
  hash: string,
  base: string,
): string | null {
  if (!new URLSearchParams(search).has("path")) return null;
  return `${base}storybook/${search}${hash}`;
}

/** An inline `<script>` body that leaves for Storybook before the page paints. */
export function storybookRedirectScript(base: string): string {
  return `{const to=(${storybookRedirect.toString()})(location.search,location.hash,${JSON.stringify(base).replace(/</g, "\\u003c")});if(to)location.replace(to)}`;
}

/** Routes that moved, each to where it lives now; the old address keeps working. */
export const MOVED: Readonly<Record<string, string>> = {
  "/demos/inbox/": "/demos/mail/",
};

/**
 * The page left at a moved route, `to` with the base on: it leaves before it paints, query and
 * hash kept, so a `?thread=` link still opens its thread. The meta refresh covers a reader
 * without scripts; the canonical link tells a crawler where the page is now.
 */
export function movedPage(to: string): string {
  const attr = to.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Moved</title>
    <link rel="canonical" href="${attr}" />
    <meta http-equiv="refresh" content="0; url=${attr}" />
    <script>location.replace(${JSON.stringify(to).replace(/</g, "\\u003c")}+location.search+location.hash)</script>
  </head>
  <body>
    <p>This page moved to <a href="${attr}">${attr}</a>.</p>
  </body>
</html>
`;
}
