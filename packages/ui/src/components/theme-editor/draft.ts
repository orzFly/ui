import {
  type ColorScheme,
  type CustomSide,
  type CustomTerminal,
  type CustomTheme,
  composeTheme,
  DEFAULT_VARIANT,
  schemesOf,
  type TerminalTheme,
  type TerminalTokenName,
  type TerminalTokens,
  type Theme,
  type TokenName,
  type Tokens,
} from "@orz/themes";
import { useMemo, useReducer } from "react";
import { uniqueLabel } from "../../lib/theme-file.ts";
import type { ThemePref } from "../../theme/pref.ts";

export type BasedSide = Extract<CustomSide, { base: unknown }>;
export type DetachedSide = Exclude<CustomSide, { base: unknown }>;
export type BasedTerminal = Extract<CustomTerminal, { base: unknown }>;
export type DetachedTerminal = Exclude<CustomTerminal, { base: unknown }>;
export type BaseRef = BasedSide["base"];
export type TerminalBaseRef = BasedTerminal["base"];

export type SideMode = "none" | "based" | "detached";
export type TerminalMode = "follow" | "based" | "detached";
/** A side's terminal, or both sides' at once ("Same terminal for both sides"). */
export type TerminalTarget = ColorScheme | "both";

/** What a side shows now: the composed palette's colours. */
export interface SidePalette {
  tokens: Tokens;
  terminal: TerminalTokens;
}

/** The forms a side and its terminal last had in each mode, this session. */
export interface SideMemory {
  based?: BasedSide;
  detached?: DetachedSide;
  terminalBased?: BasedTerminal;
  terminalDetached?: DetachedTerminal;
}

export interface DraftState {
  /** The stored theme the draft started from; null for a new one. */
  saved: CustomTheme | null;
  /** None sides are absent, so the draft is always what Save writes. */
  draft: CustomTheme;
  memory: Partial<Record<ColorScheme, SideMemory>>;
  /** The draft changed since the last load; makes a new theme dirty. */
  touched: boolean;
}

export type DraftAction =
  | { type: "load"; draft: CustomTheme; saved: CustomTheme | null }
  /** After a successful Save: `saved` (as written) becomes the draft and its baseline. */
  | { type: "markSaved"; saved: CustomTheme }
  | { type: "setLabel"; label: string }
  /**
   * `resolved`: what the side shows now (or, from None, what it would show
   * based), copied when it turns detached. `base`: the base a side takes when
   * it turns based with nothing remembered (see `fallbackBase`).
   */
  | {
      type: "setSideMode";
      scheme: ColorScheme;
      mode: SideMode;
      resolved?: SidePalette;
      base?: BaseRef;
    }
  | { type: "setBase"; scheme: ColorScheme; base: BaseRef }
  | { type: "setVariant"; scheme: ColorScheme; variant?: string }
  | { type: "setToken"; scheme: ColorScheme; name: TokenName; value: string }
  | { type: "resetToken"; scheme: ColorScheme; name: TokenName }
  | { type: "resetAll"; scheme: ColorScheme }
  /**
   * `resolved`: the terminal colours shown now, copied when it turns
   * detached. `base`: the palette a terminal takes when it turns based with
   * nothing remembered. Follow is ignored on a detached side.
   */
  | {
      type: "setTerminalMode";
      target: TerminalTarget;
      mode: TerminalMode;
      resolved?: TerminalTokens;
      base?: TerminalBaseRef;
    }
  | { type: "setTerminalBase"; target: TerminalTarget; base: TerminalBaseRef }
  | { type: "setTerminalVariant"; target: TerminalTarget; variant?: string }
  | {
      type: "setTerminalToken";
      target: TerminalTarget;
      name: TerminalTokenName;
      value: string;
    }
  | {
      type: "resetTerminalToken";
      target: TerminalTarget;
      name: TerminalTokenName;
    }
  | { type: "resetAllTerminal"; target: TerminalTarget }
  /**
   * Turning "Same terminal for both sides" on: the other side takes `from`'s
   * terminal. When `from` follows its base and the other side is detached
   * (which cannot follow), both take `resolved`, `from`'s colours, detached.
   */
  | { type: "shareTerminal"; from: ColorScheme; resolved?: TerminalTokens };

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const other = (scheme: ColorScheme): ColorScheme =>
  scheme === "light" ? "dark" : "light";

const isBased = (side: CustomSide): side is BasedSide => "base" in side;
const isBasedTerminal = (terminal: CustomTerminal): terminal is BasedTerminal =>
  "base" in terminal;

function baseRef<R extends { variant?: string }>(ref: R): R {
  const out = { ...ref };
  if (out.variant === undefined || out.variant === DEFAULT_VARIANT) {
    delete out.variant;
  }
  return out;
}

function withoutKey<K extends string, V>(
  record: Partial<Record<K, V>> | undefined,
  key: K,
): Partial<Record<K, V>> | undefined {
  if (record === undefined || !Object.hasOwn(record, key)) return record;
  const out = { ...record };
  delete out[key];
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `{ ...object, [key]: value }`, the key left out when the value is undefined. */
function setOptional<T extends object, K extends keyof T>(
  object: T,
  key: K,
  value: T[K] | undefined,
): T {
  const out = { ...object };
  if (value === undefined) delete out[key];
  else out[key] = value;
  return out;
}

export function sideMode(draft: CustomTheme, scheme: ColorScheme): SideMode {
  const side = draft[scheme];
  if (side === undefined) return "none";
  return isBased(side) ? "based" : "detached";
}

/** null when the side is None. */
export function terminalMode(
  draft: CustomTheme,
  scheme: ColorScheme,
): TerminalMode | null {
  const side = draft[scheme];
  return side === undefined ? null : terminalModeOf(side);
}

function terminalModeOf(side: CustomSide): TerminalMode {
  if (side.terminal === undefined) return "follow";
  return isBasedTerminal(side.terminal) ? "based" : "detached";
}

/** Only a based UI side can leave its terminal to its base. */
export function canFollowBase(
  draft: CustomTheme,
  scheme: ColorScheme,
): boolean {
  return sideMode(draft, scheme) === "based";
}

/** True only on a based side that pins `name`. */
export function isOverridden(
  draft: CustomTheme,
  scheme: ColorScheme,
  name: TokenName,
): boolean {
  const side = draft[scheme];
  return (
    side !== undefined &&
    isBased(side) &&
    side.tokens !== undefined &&
    Object.hasOwn(side.tokens, name)
  );
}

/** True only on a based terminal that pins `name`. */
export function isTerminalOverridden(
  draft: CustomTheme,
  scheme: ColorScheme,
  name: TerminalTokenName,
): boolean {
  const terminal = draft[scheme]?.terminal;
  return (
    terminal !== undefined &&
    isBasedTerminal(terminal) &&
    terminal.tokens !== undefined &&
    Object.hasOwn(terminal.tokens, name)
  );
}

/** Overrides on the side, among `names` when given (a group's tokens). */
export function overrideCount(
  draft: CustomTheme,
  scheme: ColorScheme,
  names?: readonly TokenName[],
): number {
  const side = draft[scheme];
  if (side === undefined || !isBased(side) || side.tokens === undefined) {
    return 0;
  }
  const keys = Object.keys(side.tokens) as TokenName[];
  return names ? keys.filter((k) => names.includes(k)).length : keys.length;
}

export function terminalOverrideCount(
  draft: CustomTheme,
  scheme: ColorScheme,
  names?: readonly TerminalTokenName[],
): number {
  const terminal = draft[scheme]?.terminal;
  if (
    terminal === undefined ||
    !isBasedTerminal(terminal) ||
    terminal.tokens === undefined
  ) {
    return 0;
  }
  const keys = Object.keys(terminal.tokens) as TerminalTokenName[];
  return names ? keys.filter((k) => names.includes(k)).length : keys.length;
}

/** Both sides exist and carry equal terminals (both following counts). */
export function sameTerminal(draft: CustomTheme): boolean {
  return (
    draft.light !== undefined &&
    draft.dark !== undefined &&
    deepEqual(draft.light.terminal, draft.dark.terminal)
  );
}

/** Structural equality on JSON-like values; an undefined property counts as absent. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set(
    [...Object.keys(left), ...Object.keys(right)].filter(
      (k) => left[k] !== undefined || right[k] !== undefined,
    ),
  );
  for (const key of keys) {
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}

export function isDirty(state: DraftState): boolean {
  return state.saved === null
    ? state.touched
    : !deepEqual(state.draft, state.saved);
}

export function initDraftState(initial: {
  draft: CustomTheme;
  saved: CustomTheme | null;
}): DraftState {
  return {
    saved: initial.saved,
    draft: initial.draft,
    memory: {},
    touched: false,
  };
}

function remember(memory: SideMemory, side: CustomSide | undefined) {
  if (side === undefined) return memory;
  return isBased(side)
    ? { ...memory, based: side }
    : { ...memory, detached: side };
}

function rememberTerminal(memory: SideMemory, side: CustomSide) {
  const terminal = side.terminal;
  if (terminal === undefined) return memory;
  return isBasedTerminal(terminal)
    ? { ...memory, terminalBased: terminal }
    : { ...memory, terminalDetached: terminal };
}

function detach(
  based: BasedSide | undefined,
  resolved: SidePalette,
): DetachedSide {
  // A palette the user named is kept; a terminal following the base or
  // already detached becomes the colours it shows.
  const terminal =
    based?.terminal && isBasedTerminal(based.terminal)
      ? based.terminal
      : { tokens: { ...resolved.terminal } };
  return { tokens: { ...resolved.tokens }, terminal };
}

type Patch = Pick<DraftState, "draft" | "memory">;

function setSideMode(
  state: DraftState,
  action: Extract<DraftAction, { type: "setSideMode" }>,
): Patch | null {
  const { scheme, mode } = action;
  const current = state.draft[scheme];
  if (sideMode(state.draft, scheme) === mode) return null;
  const memory = remember(state.memory[scheme] ?? {}, current);
  let next: CustomSide | undefined;
  if (mode === "based") {
    next =
      memory.based ??
      (action.base ? { base: baseRef(action.base) } : undefined);
    if (next === undefined) return null;
  } else if (mode === "detached") {
    if (memory.detached) next = memory.detached;
    else if (action.resolved) {
      next = detach(
        current && isBased(current) ? current : memory.based,
        action.resolved,
      );
    } else return null;
  }
  return {
    draft: setOptional(state.draft, scheme, next),
    memory: { ...state.memory, [scheme]: memory },
  };
}

/** Applies `edit` to the side(s) `target` names that exist; an edit returning undefined leaves a side as is. */
function editSides(
  state: DraftState,
  target: TerminalTarget,
  edit: (
    side: CustomSide,
    memory: SideMemory,
  ) => { side: CustomSide; memory?: SideMemory } | undefined,
): Patch | null {
  let draft = state.draft;
  let memory = state.memory;
  for (const scheme of target === "both" ? SCHEMES : [target]) {
    const side = draft[scheme];
    if (side === undefined) continue;
    const result = edit(side, memory[scheme] ?? {});
    if (result === undefined || deepEqual(result.side, side)) continue;
    draft = { ...draft, [scheme]: result.side };
    if (result.memory) memory = { ...memory, [scheme]: result.memory };
  }
  return draft === state.draft ? null : { draft, memory };
}

function editBased(
  state: DraftState,
  scheme: ColorScheme,
  edit: (side: BasedSide) => BasedSide,
): Patch | null {
  return editSides(state, scheme, (side) =>
    isBased(side) ? { side: edit(side) } : undefined,
  );
}

function setTerminal(side: CustomSide, terminal: CustomTerminal | undefined) {
  return setOptional(side as BasedSide, "terminal", terminal) as CustomSide;
}

function editBasedTerminal(
  state: DraftState,
  target: TerminalTarget,
  edit: (terminal: BasedTerminal) => BasedTerminal,
): Patch | null {
  return editSides(state, target, (side) =>
    side.terminal && isBasedTerminal(side.terminal)
      ? { side: setTerminal(side, edit(side.terminal)) }
      : undefined,
  );
}

function setTerminalMode(
  state: DraftState,
  action: Extract<DraftAction, { type: "setTerminalMode" }>,
): Patch | null {
  return editSides(state, action.target, (side, sideMemory) => {
    if (terminalModeOf(side) === action.mode) return undefined;
    const memory = rememberTerminal(sideMemory, side);
    let terminal: CustomTerminal | undefined;
    if (action.mode === "follow") {
      if (!isBased(side)) return undefined;
    } else if (action.mode === "based") {
      terminal =
        memory.terminalBased ??
        (action.base ? { base: baseRef(action.base) } : undefined);
      if (terminal === undefined) return undefined;
    } else {
      terminal =
        memory.terminalDetached ??
        (action.resolved ? { tokens: { ...action.resolved } } : undefined);
      if (terminal === undefined) return undefined;
    }
    return { side: setTerminal(side, terminal), memory };
  });
}

function shareTerminal(
  state: DraftState,
  from: ColorScheme,
  resolved: TerminalTokens | undefined,
): Patch | null {
  const source = state.draft[from];
  const target = state.draft[other(from)];
  if (source === undefined || target === undefined) return null;
  if (deepEqual(source.terminal, target.terminal)) return null;
  if (source.terminal === undefined && !isBased(target)) {
    if (resolved === undefined) return null;
    const terminal = { tokens: { ...resolved } };
    return {
      draft: {
        ...state.draft,
        [from]: setTerminal(source, terminal),
        [other(from)]: setTerminal(target, terminal),
      },
      memory: state.memory,
    };
  }
  return {
    draft: {
      ...state.draft,
      [other(from)]: setTerminal(target, source.terminal),
    },
    memory: state.memory,
  };
}

function apply(state: DraftState, action: DraftAction): Patch | null {
  switch (action.type) {
    case "load":
    case "markSaved":
      return null;
    case "setLabel":
      return action.label === state.draft.label
        ? null
        : {
            draft: { ...state.draft, label: action.label },
            memory: state.memory,
          };
    case "setSideMode":
      return setSideMode(state, action);
    case "setBase":
      return editBased(state, action.scheme, (side) => ({
        ...side,
        base: baseRef(action.base),
      }));
    case "setVariant":
      return editBased(state, action.scheme, (side) => ({
        ...side,
        base: baseRef({ ...side.base, variant: action.variant }),
      }));
    case "setToken":
      // A based side pins the value even when it equals the base's: only ↺ unpins.
      return editSides(state, action.scheme, (side) => ({
        side: {
          ...side,
          tokens: { ...side.tokens, [action.name]: action.value },
        } as CustomSide,
      }));
    case "resetToken":
      return editBased(state, action.scheme, (side) =>
        setOptional(side, "tokens", withoutKey(side.tokens, action.name)),
      );
    case "resetAll":
      return editBased(state, action.scheme, (side) =>
        setOptional(side, "tokens", undefined),
      );
    case "setTerminalMode":
      return setTerminalMode(state, action);
    case "setTerminalBase":
      return editSides(state, action.target, (side) => {
        const terminal = side.terminal;
        const tokens =
          terminal && isBasedTerminal(terminal) ? terminal.tokens : undefined;
        const next: BasedTerminal = { base: baseRef(action.base) };
        if (tokens) next.tokens = tokens;
        return { side: setTerminal(side, next) };
      });
    case "setTerminalVariant":
      return editBasedTerminal(state, action.target, (terminal) => ({
        ...terminal,
        base: baseRef({ ...terminal.base, variant: action.variant }),
      }));
    case "setTerminalToken":
      return editSides(state, action.target, (side) => {
        const terminal = side.terminal;
        const pinned = { [action.name]: action.value };
        let next: CustomTerminal;
        if (terminal === undefined) {
          // Editing a following terminal pins the colour on the UI base's own
          // terminal, which shows exactly what following did.
          if (!isBased(side)) return undefined;
          next = { base: baseRef({ ...side.base }), tokens: pinned };
        } else if (isBasedTerminal(terminal)) {
          next = { ...terminal, tokens: { ...terminal.tokens, ...pinned } };
        } else {
          next = { tokens: { ...terminal.tokens, ...pinned } };
        }
        return { side: setTerminal(side, next) };
      });
    case "resetTerminalToken":
      return editBasedTerminal(state, action.target, (terminal) =>
        setOptional(
          terminal,
          "tokens",
          withoutKey(terminal.tokens, action.name),
        ),
      );
    case "resetAllTerminal":
      return editBasedTerminal(state, action.target, (terminal) =>
        setOptional(terminal, "tokens", undefined),
      );
    case "shareTerminal":
      return shareTerminal(state, action.from, action.resolved);
  }
}

export function draftReducer(
  state: DraftState,
  action: DraftAction,
): DraftState {
  if (action.type === "load") return initDraftState(action);
  if (action.type === "markSaved") {
    return {
      ...state,
      saved: action.saved,
      draft: action.saved,
      touched: false,
    };
  }
  const patch = apply(state, action);
  return patch === null ? state : { ...state, ...patch, touched: true };
}

/**
 * The draft composed for preview; null when no side resolves. An empty name
 * still composes, so the preview keeps up while the user retypes it.
 */
export function composeDraft(
  draft: CustomTheme,
  themes: readonly TerminalTheme[],
): Theme | null {
  return composeTheme(
    { ...draft, label: draft.label.trim() || "Untitled theme" },
    themes,
  );
}

/**
 * The draft for one editing session. `initial` is read on mount only; switch
 * themes with a `load` action. `themes`: the UI and terminal lists together,
 * as the store composes against.
 */
export function useThemeDraft(
  initial: { draft: CustomTheme; saved: CustomTheme | null },
  themes: readonly TerminalTheme[],
) {
  const [state, dispatch] = useReducer(draftReducer, initial, initDraftState);
  const composed = useMemo(
    () => composeDraft(state.draft, themes),
    [state.draft, themes],
  );
  return {
    state,
    draft: state.draft,
    saved: state.saved,
    dirty: isDirty(state),
    composed,
    dispatch,
  };
}

const ID_LENGTH = 8;

/** `custom-` and 8 random base-36 characters, regenerated while it is in `taken`. */
export function newThemeId(taken: readonly string[]): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
    // 252 is the largest multiple of 36 below 256; rejecting above it keeps
    // every character equally likely.
    if (bytes.some((b) => b >= 252)) continue;
    const id = `custom-${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
    if (!taken.includes(id)) return id;
  }
}

export interface NewThemeContext {
  pref: ThemePref;
  /** The UI theme the page shows, and its variant (`useTheme()`'s `theme` and `variant`). */
  resolved: { theme: Theme; variant: string };
  /** The store's base UI themes, custom ones excluded. */
  baseThemes: readonly Theme[];
  customs: readonly CustomTheme[];
  /** Labels a new theme must not take: custom and base themes'. */
  labels: readonly string[];
}

const takenIds = (ctx: Pick<NewThemeContext, "baseThemes" | "customs">) => [
  ...ctx.customs.map((c) => c.id),
  ...ctx.baseThemes.map((t) => t.id),
];

function copySides(custom: CustomTheme): Pick<CustomTheme, ColorScheme> {
  const out: Pick<CustomTheme, ColorScheme> = {};
  for (const scheme of SCHEMES) {
    const side = custom[scheme];
    if (side !== undefined) out[scheme] = structuredClone(side);
  }
  return out;
}

/** "*Label* copy", numbered until free, as an unsaved theme with a new id. */
export function duplicate(
  custom: CustomTheme,
  ctx: Pick<NewThemeContext, "baseThemes" | "customs" | "labels">,
): CustomTheme {
  return {
    id: newThemeId(takenIds(ctx)),
    label: uniqueLabel(`${custom.label} copy`, ctx.labels),
    ...copySides(custom),
  };
}

/**
 * A copy of what the page shows: on a base theme, each of its sides based on
 * it with the current variant where that palette defines it; on a custom
 * theme, its sides.
 */
export function newTheme(ctx: NewThemeContext): CustomTheme {
  const id = newThemeId(takenIds(ctx));
  const label = uniqueLabel("Custom theme", ctx.labels);
  const shown = ctx.resolved.theme.id;
  const custom = ctx.customs.find((c) => c.id === shown);
  if (custom !== undefined) return { id, label, ...copySides(custom) };

  const base =
    ctx.baseThemes.find((t) => t.id === shown) ??
    ctx.baseThemes[0] ??
    ctx.resolved.theme;
  const variant =
    ctx.pref.ui?.theme === base.id ? ctx.pref.ui.variant : ctx.resolved.variant;
  const out: CustomTheme = { id, label };
  for (const scheme of schemesOf(base)) {
    const variants = base[scheme]?.variants ?? {};
    out[scheme] = {
      base: baseRef({
        theme: base.id,
        variant:
          variant !== undefined && Object.hasOwn(variants, variant)
            ? variant
            : undefined,
      }),
    };
  }
  return out;
}

/**
 * The base a side takes when it turns based with nothing remembered: the
 * committed UI theme if it is a base theme with `scheme`, else the first base
 * theme that has it.
 */
export function fallbackBase(
  scheme: ColorScheme,
  committedTheme: string | undefined,
  baseThemes: readonly Theme[],
): BaseRef | undefined {
  const theme =
    baseThemes.find((t) => t.id === committedTheme && t[scheme]) ??
    baseThemes.find((t) => t[scheme] !== undefined);
  return theme && { theme: theme.id };
}
