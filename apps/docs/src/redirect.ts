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
