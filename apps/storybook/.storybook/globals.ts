// Type-only imports: Storybook's manager esbuild bundles this file, and it
// cannot compile @orz/* (see toolbar/build.ts).
import type { ThemePick, ThemePref } from "@orz/ui/theme";

export type Slot = "ui" | "terminal";
export type GlobalKey = "theme" | "terminal";
export type ThemeGlobals = Partial<Record<GlobalKey, string>>;

export const SLOTS: readonly Slot[] = ["ui", "terminal"];
export const KEY_OF: Readonly<Record<Slot, GlobalKey>> = {
  ui: "theme",
  terminal: "terminal",
};
/** Storybook's `initialGlobals`: the first theme under system, the terminal following. */
export const INITIAL_GLOBALS = { theme: "system", terminal: "follow" } as const;

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

/** Both slots from Storybook's globals; a missing global reads as its initial value. */
export function prefOf(
  globals: Readonly<Record<string, unknown>>,
  defaultThemeId: string,
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
  return pref;
}

/**
 * The globals a commit from `before` to `after` writes: only the slots whose
 * pick changed, and not one already equal to `last`. Normalizing drops a pick
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
  return out;
}
