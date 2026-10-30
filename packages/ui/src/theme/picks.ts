import {
  type ColorScheme,
  DEFAULT_VARIANT,
  schemesOf,
  type TerminalTheme,
  type Theme,
  themesForStyle,
} from "@orz/themes";
import type { ThemePick, ThemePref } from "./pref.ts";

/**
 * Switching the UI from style `from` to `to`: the UI pick is remembered under
 * `from`, and the one remembered under `to` comes back, or, when its theme is
 * gone, `to`'s first theme in the current mode. The terminal pick stays.
 */
export function prefForStyle(
  pref: ThemePref,
  from: string,
  to: string,
  themes: readonly Theme[],
): ThemePref {
  if (from === to) return pref;
  const byStyle: Record<string, ThemePick> = { ...pref.uiByStyle };
  if (pref.ui) byStyle[from] = pref.ui;
  const remembered = Object.hasOwn(byStyle, to) ? byStyle[to] : undefined;
  delete byStyle[to];
  const next: ThemePref = { ...pref, style: to };
  delete next.uiByStyle;
  if (Object.keys(byStyle).length > 0) next.uiByStyle = byStyle;
  const own = themesForStyle(themes, to);
  const first = own[0];
  if (remembered && own.some((t) => t.id === remembered.theme)) {
    next.ui = remembered;
  } else if (first) {
    next.ui = { theme: first.id, mode: pref.ui?.mode ?? "system" };
  } else if (remembered) {
    // A style with no themes of its own shows every theme.
    next.ui = remembered;
  }
  return next;
}

/** The palettes of `theme` that define `variantId`; `default` is on every one. */
export function schemesDefining(
  theme: TerminalTheme,
  variantId: string,
): ColorScheme[] {
  return schemesOf(theme).filter(
    (scheme) =>
      variantId === DEFAULT_VARIANT ||
      Object.hasOwn(theme[scheme]?.variants ?? {}, variantId),
  );
}

/**
 * Picking a theme row: its default variant, the current mode kept as stored.
 * The store fits the mode to a one-palette theme.
 */
export function pickForTheme(
  current: ThemePick,
  theme: TerminalTheme,
): ThemePick {
  return { theme: theme.id, mode: current.mode };
}

/**
 * Picking a variant. Under `system` the mode stays, so a dark-only variant
 * picked by day shows at night. A pinned mode whose palette lacks the variant
 * moves to one that has it, or the click would show nothing.
 */
export function pickForVariant(
  current: ThemePick,
  theme: TerminalTheme,
  variantId: string,
): ThemePick {
  const defining = schemesDefining(theme, variantId);
  const mode =
    current.mode !== "system" && !defining.includes(current.mode)
      ? (defining[0] ?? current.mode)
      : current.mode;
  const pick: ThemePick = { theme: theme.id, mode };
  if (variantId !== DEFAULT_VARIANT) pick.variant = variantId;
  return pick;
}

/**
 * What hovering a variant shows: the pick it would commit, with the mode
 * pinned to a palette that has the variant when the one `system` shows now
 * does not, so hovering AMOLED by day still shows AMOLED.
 */
export function previewForVariant(
  current: ThemePick,
  theme: TerminalTheme,
  variantId: string,
  systemScheme: ColorScheme,
): ThemePick {
  const pick = pickForVariant(current, theme, variantId);
  if (pick.mode !== "system") return pick;
  const defining = schemesDefining(theme, variantId);
  if (defining.includes(systemScheme) || defining[0] === undefined) return pick;
  return { ...pick, mode: defining[0] };
}
