/** Inside a <script>, so `<` is escaped: a key holding `</script>` would end it. */
function literal(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * An inline script for `<head>` that applies the persisted theme before the
 * bundle loads, so a dark-theme reload never flashes white. Built from the
 * same keys the store is given, so the two cannot drift apart; it reads the
 * stored kind rather than the slug, so it needs no list of dark themes.
 */
export function themePaintGuardScript({
  storageKey,
  kindStorageKey = `${storageKey}-kind`,
}: {
  storageKey: string;
  kindStorageKey?: string;
}): string {
  return `(() => {
  try {
    const theme = localStorage.getItem(${literal(storageKey)});
    const kind = localStorage.getItem(${literal(kindStorageKey)});
    const dark = kind
      ? kind === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
    if (theme && theme !== "system")
      document.documentElement.dataset.theme = theme;
  } catch {}
})();`;
}
