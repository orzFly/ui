// Type-only imports: Storybook's manager esbuild bundles this file, and it
// cannot compile @orz/* (see toolbar/build.ts).
import type { ThemePick, ThemePref } from "@orz/ui/theme";

export type Slot = "ui" | "terminal";
export type GlobalKey = "theme" | "terminal" | "style";
export type ThemeGlobals = Partial<Record<GlobalKey, string>>;

export const SLOTS: readonly Slot[] = ["ui", "terminal"];
export const KEY_OF: Readonly<Record<Slot, "theme" | "terminal">> = {
  ui: "theme",
  terminal: "terminal",
};
/** Every global the theme store reads. */
export const GLOBAL_KEYS: readonly GlobalKey[] = ["theme", "terminal", "style"];
/**
 * Storybook's `initialGlobals`: the first theme under system, the terminal
 * following, the default style.
 */
export const INITIAL_GLOBALS = {
  theme: "system",
  terminal: "follow",
  style: "default",
} as const;
// A style id is already inside Storybook's URL charset.
const STYLE = /^[A-Za-z0-9_-]+$/;

// `_`, not `:`: Storybook drops a URL global holding anything outside
// [a-zA-Z0-9 _-], so a reload would lose the pick.
const PICK = /^(.+)_(light|dark|system)(?:_([A-Za-z0-9-]+))?$/;

/** A slot's pick as its global's string. Pass the store's normalized pick, so the string is canonical. */
export function encodePick(
  pick: ThemePick | undefined,
  slot: Slot,
  defaultThemeId: string,
): string {
  if (pick === undefined) return INITIAL_GLOBALS[KEY_OF[slot]];
  if (
    slot === "ui" &&
    pick.theme === defaultThemeId &&
    pick.mode === "system" &&
    pick.variant === undefined
  ) {
    return INITIAL_GLOBALS.theme;
  }
  const head = `${pick.theme}_${pick.mode}`;
  return pick.variant === undefined ? head : `${head}_${pick.variant}`;
}

/** undefined for "follow" and for a string that is no pick; the store then falls back. */
export function decodePick(
  value: unknown,
  slot: Slot,
  defaultThemeId: string,
): ThemePick | undefined {
  if (typeof value !== "string") return undefined;
  if (slot === "ui" && value === INITIAL_GLOBALS.theme) {
    return { theme: defaultThemeId, mode: "system" };
  }
  const match = PICK.exec(value);
  if (match === null) return undefined;
  const [, theme, mode, variant] = match;
  const pick: ThemePick = { theme, mode: mode as ThemePick["mode"] };
  if (variant !== undefined) pick.variant = variant;
  return pick;
}

/**
 * The theme globals in a Storybook URL's `globals` parameter
 * (`key:value;key:value`), which the manager's URL and the preview iframe's
 * both carry, so either side can paint before the first globals event.
 */
export function urlGlobals(search: string): ThemeGlobals {
  const out: ThemeGlobals = {};
  const raw = new URLSearchParams(search).get("globals") ?? "";
  for (const pair of raw.split(";")) {
    const colon = pair.indexOf(":");
    const key = pair.slice(0, colon);
    if (colon > 0 && (GLOBAL_KEYS as readonly string[]).includes(key)) {
      out[key as GlobalKey] = pair.slice(colon + 1);
    }
  }
  return out;
}

/** The style global's string: the default style is its initial value. */
export function encodeStyle(pref: ThemePref): string {
  return pref.style ?? INITIAL_GLOBALS.style;
}

/**
 * Both slots and the style from Storybook's globals; a missing global reads
 * as its initial value. The globals hold no per-style memory, so the store's
 * own `uiByStyle` is passed back in.
 */
export function prefOf(
  globals: Readonly<Record<string, unknown>>,
  defaultThemeId: string,
  uiByStyle?: ThemePref["uiByStyle"],
): ThemePref {
  const pref: ThemePref = {};
  for (const slot of SLOTS) {
    const key = KEY_OF[slot];
    const pick = decodePick(
      globals[key] ?? INITIAL_GLOBALS[key],
      slot,
      defaultThemeId,
    );
    if (pick !== undefined) pref[slot] = pick;
  }
  const style = globals.style;
  if (
    typeof style === "string" &&
    style !== INITIAL_GLOBALS.style &&
    STYLE.test(style)
  ) {
    pref.style = style;
  }
  if (uiByStyle !== undefined) pref.uiByStyle = uiByStyle;
  return pref;
}

/**
 * The globals a commit from `before` to `after` writes: only the slots whose
 * pick changed and the style if it did, and not one already equal to `last`. Normalizing drops a pick
 * whose theme this browser lacks, so re-encoding an untouched slot would
 * overwrite a shared custom id with the fallback.
 */
export function changedGlobals(
  before: ThemePref,
  after: ThemePref,
  last: ThemeGlobals,
  defaultThemeId: string,
): ThemeGlobals {
  const out: ThemeGlobals = {};
  for (const slot of SLOTS) {
    const value = encodePick(after[slot], slot, defaultThemeId);
    if (value === encodePick(before[slot], slot, defaultThemeId)) continue;
    if (value === last[KEY_OF[slot]]) continue;
    out[KEY_OF[slot]] = value;
  }
  const style = encodeStyle(after);
  if (style !== encodeStyle(before) && style !== last.style) out.style = style;
  return out;
}

/**
 * `url` with the theme globals as its `globals` parameter, in the form
 * urlGlobals reads and Storybook's own preview applies on load.
 */
export function withUrlGlobals(url: string, globals: ThemeGlobals): string {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  const pairs = Object.entries(globals).map(
    ([key, value]) => `${key}:${value}`,
  );
  if (pairs.length > 0) params.set("globals", pairs.join(";"));
  else params.delete("globals");
  const search = params.toString();
  return search === "" ? path : `${path}?${search}`;
}
