import type { ColorScheme } from "@orz/themes";

/**
 * The guard's own: the canvas has the theme's background before the
 * stylesheet does. The store's rule leaves it out, because a background on
 * `<html>` stops body's from reaching the canvas.
 */
const PAGE_BACKGROUND = "background-color: var(--background);";

/** The paint cookie's value, as JSON: each side's background the UI pick can show. */
export type PaintBackgrounds = Partial<Record<ColorScheme, string>>;

// A colour as a token holds one: no `;`, braces, quotes or `<`, which could
// close the declaration, the rule or the <style> it lands in.
const COLOR = /^[\w#.,%()/+\- ]{1,100}$/;

/** An open `(` would swallow the rest of the stylesheet as a function's arguments. */
function balanced(color: string): boolean {
  let depth = 0;
  for (const c of color) {
    if (c === "(") depth++;
    else if (c === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

function parseBackgrounds(value: string): PaintBackgrounds | null {
  // Frameworks hand a cookie over decoded or not; the store writes it encoded.
  for (const text of [value, safeDecode(value)]) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as PaintBackgrounds;
      }
    } catch {
      // try the other form
    }
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * CSS for a server to inline in `<head>`, from the value of the store's
 * `paintCookie`: the page's background and color scheme, chosen by the OS
 * when both sides are stored. Empty for a missing or malformed value.
 */
export function themePaintCookieStyle(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const backgrounds = parseBackgrounds(value);
  const side = (scheme: ColorScheme) => {
    const color = backgrounds?.[scheme];
    return typeof color === "string" && COLOR.test(color) && balanced(color)
      ? `html{background-color:${color};color-scheme:${scheme}}`
      : "";
  };
  const light = side("light");
  const dark = side("dark");
  if (light && dark) {
    return `${light}@media (prefers-color-scheme: dark){${dark}}`;
  }
  return light || dark;
}

/** Inside a `<script>`, so `<` is escaped: a key holding `</script>` would end it. */
function literal(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * An inline script for `<head>` that paints the persisted theme before the
 * bundle loads, so a dark-theme reload never flashes white. It replays the
 * declarations the store cached under `paintKey`, so neither it nor the page
 * needs a theme list; the store adopts the `<style>` it inserts.
 */
export function themePaintGuardScript({
  storageKey,
  paintKey = `${storageKey}-paint`,
}: {
  storageKey: string;
  paintKey?: string;
}): string {
  return `(() => {
  try {
    const root = document.documentElement;
    const raw = localStorage.getItem(${literal(paintKey)});
    if (!raw) {
      // Written by the store before it cached declarations; it rewrites the
      // cache on creation, so this path runs once.
      if (localStorage.getItem(${literal(`${storageKey}-kind`)}) === "dark")
        root.classList.add("dark");
      return;
    }
    const cache = JSON.parse(raw);
    const pick = (side) => {
      if (!side) return null;
      const scheme =
        side.light && side.dark
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : side.light
            ? "light"
            : "dark";
      return { scheme, text: side[scheme] || "" };
    };
    const ui = pick(cache.ui);
    const terminal = pick(cache.terminal);
    const style = document.createElement("style");
    style.setAttribute("data-orz-theme", "");
    // Doubled because a stylesheet <link> parsed after this script would
    // otherwise outrank it on order; the store rewrites it as plain :root
    // and moves it last.
    style.textContent =
      ":root:root { " + [ui && ui.text, ui && ${literal(PAGE_BACKGROUND)}, terminal && terminal.text].filter(Boolean).join(" ") + " }";
    document.head.append(style);
    if (ui) {
      root.classList.toggle("dark", ui.scheme === "dark");
      root.dataset.theme = cache.ui.theme;
      if (cache.ui.variant) root.dataset.variant = cache.ui.variant;
    }
    if (terminal) root.dataset.terminalTheme = cache.terminal.theme;
  } catch {}
})();`;
}
