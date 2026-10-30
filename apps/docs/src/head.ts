import { defaultStyle, raymondStyle } from "@orz/themes";
import { themePaintGuardScript } from "@orz/ui/theme";
import type { PageMeta } from "./page.ts";
import { storybookRedirectScript } from "./redirect.ts";

/** The theme store's key; the paint guard replays what the store cached under it. */
export const THEME_STORAGE_KEY = "orz-docs-theme";

/**
 * The styles the site offers. A style other than the default needs its
 * stylesheet in styles.css too.
 */
export const SITE_STYLES = [defaultStyle, raymondStyle];

const SITE = "@orz/ui";

export function documentTitle(meta: PageMeta | undefined): string {
  if (!meta) return `Page not found — ${SITE}`;
  return meta.title === SITE ? SITE : `${meta.title} — ${SITE}`;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

/** What a prerendered page carries in `<head>` ahead of the bundle. */
export function headOf(meta: PageMeta | undefined, base: string): string {
  return [
    `<title>${escapeHtml(documentTitle(meta))}</title>`,
    meta?.description
      ? `<meta name="description" content="${escapeHtml(meta.description)}" />`
      : "",
    `<script>${storybookRedirectScript(base)}</script>`,
    `<script>${themePaintGuardScript({ storageKey: THEME_STORAGE_KEY })}</script>`,
  ]
    .filter(Boolean)
    .join("\n    ");
}
