import type { TextMateTheme } from "@orz/ui/theme";

type Pierre = typeof import("@pierre/diffs");

// pierre logs an error on a second registration of one name, so a theme is
// registered once per page; and it is only ever imported through
// loadPierre(), so no value import of it enters the app chunk (T-24).
const registered = new Set<string>();
const pending = new Map<string, TextMateTheme>();
let pierre: Pierre | undefined;
let loading: Promise<void> | undefined;

function register(module: Pierre, theme: TextMateTheme) {
  registered.add(theme.name);
  module.registerCustomTheme(theme.name, () => Promise.resolve(theme));
}

/**
 * Makes a palette's own syntax theme known to pierre under its name, now when
 * pierre is loaded, or else as soon as `loadPierre` loads it.
 */
export function ensureSyntaxTheme(theme: TextMateTheme): string {
  if (registered.has(theme.name)) return theme.name;
  if (pierre) register(pierre, theme);
  else pending.set(theme.name, theme);
  return theme.name;
}

/** Loads pierre once and registers every theme picked before it arrived. */
export function loadPierre(): Promise<void> {
  loading ??= import("@pierre/diffs").then((module) => {
    pierre = module;
    for (const theme of pending.values()) register(module, theme);
    pending.clear();
  });
  return loading;
}
