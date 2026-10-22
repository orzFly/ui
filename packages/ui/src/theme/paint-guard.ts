/** Inside a <script>, so `<` is escaped: a key holding `</script>` would end it. */
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
      ":root:root { " + [ui && ui.text, terminal && terminal.text].filter(Boolean).join(" ") + " }";
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
