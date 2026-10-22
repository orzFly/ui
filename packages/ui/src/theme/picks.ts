import {
  type ColorScheme,
  DEFAULT_VARIANT,
  schemesOf,
  type TerminalTheme,
} from "@orz/themes";
import type { ThemePick } from "./pref.ts";

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
