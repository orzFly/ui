import {
  type AnyCustomTheme,
  type ColorScheme,
  type CustomSide,
  type CustomTerminal,
  type CustomTerminalTheme,
  type CustomTheme,
  composeTerminalTheme,
  composeTheme,
  DEFAULT_STYLE,
  DEFAULT_VARIANT,
  isCustomTerminalTheme,
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

/**
 * `C` narrows the draft's kind for a caller that knows it; the editor, which
 * loads themes of both kinds, keeps the default union.
 */
export interface DraftState<C extends AnyCustomTheme = AnyCustomTheme> {
  /** The stored theme the draft started from; null for a new one. */
  saved: C | null;
  /** None sides are absent, so the draft is always what Save writes. */
  draft: C;
  memory: Partial<Record<ColorScheme, SideMemory>>;
  /** The draft changed since the last load; makes a new theme dirty. */
  touched: boolean;
}

export type DraftAction =
  | { type: "load"; draft: AnyCustomTheme; saved: AnyCustomTheme | null }
  /** After a successful Save: `saved` (as written) becomes the draft and its baseline. */
  | { type: "markSaved"; saved: AnyCustomTheme }
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
   * nothing remembered. Follow is ignored on a detached side. On a terminal
   * theme the side itself is the terminal: "none" removes it, and neither
   * "follow" nor "both" applies.
   */
  | {
      type: "setTerminalMode";
      target: TerminalTarget;
      mode: TerminalMode | "none";
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
   * (which cannot follow), both take `resolved`, `from`'s colours, detached;
   * when it follows another base, both name `from`'s base.
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

/** On a terminal theme, the mode of the side's terminal palette. */
export function sideMode(draft: AnyCustomTheme, scheme: ColorScheme): SideMode {
  const side = draft[scheme];
  if (side === undefined) return "none";
  return "base" in side ? "based" : "detached";
}

/** The terminal palette a side carries: on a terminal theme, the side itself. */
export function terminalOf(
  draft: AnyCustomTheme,
  scheme: ColorScheme,
): CustomTerminal | undefined {
  return isCustomTerminalTheme(draft) ? draft[scheme] : draft[scheme]?.terminal;
}

/** null when the side is None. A terminal theme's side never follows. */
export function terminalMode(
  draft: AnyCustomTheme,
  scheme: ColorScheme,
): TerminalMode | null {
  if (isCustomTerminalTheme(draft)) {
    const side = draft[scheme];
    if (side === undefined) return null;
    return isBasedTerminal(side) ? "based" : "detached";
  }
  const side = draft[scheme];
  return side === undefined ? null : terminalModeOf(side);
}

function terminalModeOf(side: CustomSide): TerminalMode {
  if (side.terminal === undefined) return "follow";
  return isBasedTerminal(side.terminal) ? "based" : "detached";
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
  draft: AnyCustomTheme,
  scheme: ColorScheme,
  name: TerminalTokenName,
): boolean {
  const terminal = terminalOf(draft, scheme);
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
  draft: AnyCustomTheme,
  scheme: ColorScheme,
  names?: readonly TerminalTokenName[],
): number {
  const terminal = terminalOf(draft, scheme);
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

/**
 * Both sides exist and carry equal terminals. Two following terminals count
 * only on the same base and variant: following different bases shows
 * different colours, and a pin would give each side a different reference.
 */
export function sameTerminal(draft: CustomTheme): boolean {
  const { light, dark } = draft;
  if (light === undefined || dark === undefined) return false;
  if (!deepEqual(light.terminal, dark.terminal)) return false;
  return light.terminal !== undefined || followSameBase(light, dark);
}

function followSameBase(a: CustomSide, b: CustomSide): boolean {
  return (
    isBased(a) && isBased(b) && deepEqual(baseRef(a.base), baseRef(b.base))
  );
}

/**
 * Only a based UI side can leave its terminal to its base; both sides at
 * once only when they are based on the same base.
 */
export function canFollow(draft: CustomTheme, target: TerminalTarget): boolean {
  if (target !== "both") return sideMode(draft, target) === "based";
  const { light, dark } = draft;
  return light !== undefined && dark !== undefined
    ? followSameBase(light, dark)
    : SCHEMES.some((s) => sideMode(draft, s) === "based");
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

export function isDirty(state: DraftState<AnyCustomTheme>): boolean {
  return state.saved === null
    ? state.touched
    : !deepEqual(state.draft, state.saved);
}

export function initDraftState<C extends AnyCustomTheme>(initial: {
  draft: C;
  saved: C | null;
}): DraftState<C> {
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
/** The state while the draft is a UI theme; every UI action reads it. */
type UiState = DraftState<CustomTheme>;
type TerminalState = DraftState<CustomTerminalTheme>;

function setSideMode(
  state: UiState,
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
  state: UiState,
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
  state: UiState,
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
  state: UiState,
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
  state: UiState,
  action: Extract<DraftAction, { type: "setTerminalMode" }>,
): Patch | null {
  const { target, mode } = action;
  if (mode === "none") return null;
  // For both sides, the first side's choice is written to each, so a shared
  // terminal stays one terminal even when the sides remember different ones.
  const source =
    target === "both" ? SCHEMES.find((s) => state.draft[s]) : target;
  const side = source && state.draft[source];
  if (source === undefined || side === undefined) return null;
  if (terminalModeOf(side) === mode) return null;
  const memory = rememberTerminal(state.memory[source] ?? {}, side);
  let terminal: CustomTerminal | undefined;
  if (mode === "follow") {
    if (!canFollow(state.draft, target)) return null;
  } else if (mode === "based") {
    terminal =
      memory.terminalBased ??
      (action.base ? { base: baseRef(action.base) } : undefined);
    if (terminal === undefined) return null;
  } else {
    terminal =
      memory.terminalDetached ??
      (action.resolved ? { tokens: { ...action.resolved } } : undefined);
    if (terminal === undefined) return null;
  }
  return editSides(state, target, (each, eachMemory) => ({
    side: setTerminal(each, terminal),
    memory: rememberTerminal(eachMemory, each),
  }));
}

function shareTerminal(
  state: UiState,
  from: ColorScheme,
  resolved: TerminalTokens | undefined,
): Patch | null {
  const source = state.draft[from];
  const target = state.draft[other(from)];
  if (source === undefined || target === undefined) return null;
  if (sameTerminal(state.draft)) return null;
  if (
    source.terminal === undefined &&
    isBased(source) &&
    isBased(target) &&
    !followSameBase(source, target)
  ) {
    // Following two different bases is not one terminal; both name the
    // source's base, which shows what following it did.
    const terminal = { base: baseRef({ ...source.base }) };
    return {
      draft: {
        ...state.draft,
        [from]: setTerminal(source, terminal),
        [other(from)]: setTerminal(target, terminal),
      },
      memory: state.memory,
    };
  }
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

/** Applies `edit` to a terminal theme's side, when it exists. */
function editTerminalSide(
  state: TerminalState,
  target: TerminalTarget,
  edit: (side: CustomTerminal) => CustomTerminal | undefined,
): Patch | null {
  if (target === "both") return null;
  const side = state.draft[target];
  const next = side && edit(side);
  if (next === undefined || deepEqual(next, side)) return null;
  return { draft: { ...state.draft, [target]: next }, memory: state.memory };
}

function editBasedTerminalSide(
  state: TerminalState,
  target: TerminalTarget,
  edit: (terminal: BasedTerminal) => BasedTerminal,
): Patch | null {
  return editTerminalSide(state, target, (side) =>
    isBasedTerminal(side) ? edit(side) : undefined,
  );
}

/** None · Based on a palette · Fully custom for one side of a terminal theme. */
function setTerminalSideMode(
  state: TerminalState,
  action: Extract<DraftAction, { type: "setTerminalMode" }>,
): Patch | null {
  const { target, mode } = action;
  if (target === "both" || mode === "follow") return null;
  if (sideMode(state.draft, target) === mode) return null;
  const current = state.draft[target];
  let memory = state.memory[target] ?? {};
  if (current !== undefined) {
    memory = isBasedTerminal(current)
      ? { ...memory, terminalBased: current }
      : { ...memory, terminalDetached: current };
  }
  let next: CustomTerminal | undefined;
  if (mode === "based") {
    next =
      memory.terminalBased ??
      (action.base ? { base: baseRef(action.base) } : undefined);
    if (next === undefined) return null;
  } else if (mode === "detached") {
    next =
      memory.terminalDetached ??
      (action.resolved ? { tokens: { ...action.resolved } } : undefined);
    if (next === undefined) return null;
  }
  return {
    draft: setOptional(state.draft, target, next),
    memory: { ...state.memory, [target]: memory },
  };
}

/** The terminal actions, on a terminal theme's sides; UI actions do nothing. */
function applyTerminal(
  state: TerminalState,
  action: DraftAction,
): Patch | null {
  switch (action.type) {
    case "setTerminalMode":
      return setTerminalSideMode(state, action);
    case "setTerminalBase":
      return editTerminalSide(state, action.target, (side) => {
        const next: BasedTerminal = { base: baseRef(action.base) };
        if (isBasedTerminal(side) && side.tokens) next.tokens = side.tokens;
        return next;
      });
    case "setTerminalVariant":
      return editBasedTerminalSide(state, action.target, (terminal) => ({
        ...terminal,
        base: baseRef({ ...terminal.base, variant: action.variant }),
      }));
    case "setTerminalToken":
      return editTerminalSide(state, action.target, (side) => {
        const pinned = { [action.name]: action.value };
        // A based side pins the value even when it equals the base's: only ↺ unpins.
        return isBasedTerminal(side)
          ? { ...side, tokens: { ...side.tokens, ...pinned } }
          : { tokens: { ...side.tokens, ...pinned } };
      });
    case "resetTerminalToken":
      return editBasedTerminalSide(state, action.target, (terminal) =>
        setOptional(
          terminal,
          "tokens",
          withoutKey(terminal.tokens, action.name),
        ),
      );
    case "resetAllTerminal":
      return editBasedTerminalSide(state, action.target, (terminal) =>
        setOptional(terminal, "tokens", undefined),
      );
    default:
      return null;
  }
}

function apply(
  state: DraftState<AnyCustomTheme>,
  action: DraftAction,
): Patch | null {
  if (action.type === "load" || action.type === "markSaved") return null;
  if (action.type === "setLabel") {
    return action.label === state.draft.label
      ? null
      : {
          draft: { ...state.draft, label: action.label },
          memory: state.memory,
        };
  }
  if (isCustomTerminalTheme(state.draft)) {
    return applyTerminal(state as TerminalState, action);
  }
  return applyUi(state as UiState, action);
}

function applyUi(state: UiState, action: DraftAction): Patch | null {
  switch (action.type) {
    case "load":
    case "markSaved":
    case "setLabel":
      return null;
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

// A load or markSaved may change the kind; only the editor sends those, and
// it keeps the union.
export function draftReducer<C extends AnyCustomTheme>(
  state: DraftState<C>,
  action: DraftAction,
): DraftState<C> {
  if (action.type === "load") return initDraftState(action) as DraftState<C>;
  if (action.type === "markSaved") {
    return {
      ...state,
      saved: action.saved as C,
      draft: action.saved as C,
      touched: false,
    };
  }
  const patch = apply(state, action);
  return patch === null
    ? state
    : ({ ...state, ...patch, touched: true } as DraftState<C>);
}

/**
 * The draft composed for preview; null when no side resolves. An empty name
 * still composes, so the preview keeps up while the user retypes it.
 */
export function composeDraft(
  draft: CustomTheme,
  themes: readonly TerminalTheme[],
): Theme | null;
export function composeDraft(
  draft: CustomTerminalTheme,
  themes: readonly TerminalTheme[],
): TerminalTheme | null;
export function composeDraft(
  draft: AnyCustomTheme,
  themes: readonly TerminalTheme[],
): Theme | TerminalTheme | null;
export function composeDraft(
  draft: AnyCustomTheme,
  themes: readonly TerminalTheme[],
): Theme | TerminalTheme | null {
  const label = draft.label.trim() || "Untitled theme";
  return isCustomTerminalTheme(draft)
    ? composeTerminalTheme({ ...draft, label }, themes)
    : composeTheme({ ...draft, label }, themes);
}

/** What a draft of kind `C` composes to. */
export type Composed<C extends AnyCustomTheme> =
  | (C extends CustomTerminalTheme
      ? TerminalTheme
      : C extends CustomTheme
        ? Theme
        : Theme | TerminalTheme)
  | null;

/**
 * The draft for one editing session. `initial` is read on mount only; switch
 * themes with a `load` action. `themes`: the UI and terminal lists together,
 * as the store composes against.
 */
export function useThemeDraft<C extends AnyCustomTheme>(
  initial: { draft: C; saved: C | null },
  themes: readonly TerminalTheme[],
) {
  const [state, dispatch] = useReducer(
    draftReducer<C>,
    initial,
    initDraftState<C>,
  );
  const composed = useMemo(
    () => composeDraft(state.draft, themes) as Composed<C>,
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
  /** Every custom theme, of both kinds. */
  customs: readonly AnyCustomTheme[];
  /** Labels a new theme must not take: custom and base themes'. */
  labels: readonly string[];
  /**
   * The style the page is drawn in (`useStyle()`'s `style`), recorded on a new UI theme so a side
   * later made fully custom keeps it. Absent = "default", which is never recorded.
   */
  style?: string;
}

export interface NewTerminalThemeContext
  extends Omit<NewThemeContext, "resolved"> {
  kind: "terminal";
  /** What the terminal shows (`useTerminalTheme()`), a following terminal included. */
  terminal: { theme: TerminalTheme; variant: string; following: boolean };
}

const takenIds = (ctx: Pick<NewThemeContext, "baseThemes" | "customs">) => [
  ...ctx.customs.map((c) => c.id),
  ...ctx.baseThemes.map((t) => t.id),
];

function copySides<C extends AnyCustomTheme>(custom: C): Pick<C, ColorScheme> {
  const out: Partial<Record<ColorScheme, unknown>> = {};
  for (const scheme of SCHEMES) {
    const side = custom[scheme];
    if (side !== undefined) out[scheme] = structuredClone(side);
  }
  return out as Pick<C, ColorScheme>;
}

/** "*Label* copy", numbered until free, as an unsaved theme of the same kind with a new id. */
export function duplicate<C extends AnyCustomTheme>(
  custom: C,
  ctx: Pick<NewThemeContext, "baseThemes" | "customs" | "labels">,
): C {
  return {
    id: newThemeId(takenIds(ctx)),
    ...(isCustomTerminalTheme(custom) ? { kind: "terminal" } : {}),
    label: uniqueLabel(`${custom.label} copy`, ctx.labels),
    ...styleOf(custom),
    ...copySides(custom),
  } as C;
}

const styleOf = (custom: AnyCustomTheme): { style?: string } =>
  !isCustomTerminalTheme(custom) && custom.style !== undefined
    ? { style: custom.style }
    : {};

/**
 * A copy of what the page shows: on a base theme, each of its sides based on
 * it with the current variant where that palette defines it; on a custom
 * theme, its sides. With `kind: "terminal"`, a copy of what the terminal
 * shows instead (see `newTerminalTheme`).
 */
export function newTheme(ctx: NewThemeContext): CustomTheme;
export function newTheme(ctx: NewTerminalThemeContext): CustomTerminalTheme;
export function newTheme(
  ctx: NewThemeContext | NewTerminalThemeContext,
): AnyCustomTheme;
export function newTheme(
  ctx: NewThemeContext | NewTerminalThemeContext,
): AnyCustomTheme {
  if ("kind" in ctx && ctx.kind === "terminal") return newTerminalTheme(ctx);
  return newUiTheme(ctx as NewThemeContext);
}

function newUiTheme(ctx: NewThemeContext): CustomTheme {
  const id = newThemeId(takenIds(ctx));
  const label = uniqueLabel("Custom theme", ctx.labels);
  const shown = ctx.resolved.theme.id;
  const custom = ctx.customs.find((c) => c.id === shown);
  if (custom !== undefined && !isCustomTerminalTheme(custom)) {
    return { id, label, ...styleOf(custom), ...copySides(custom) };
  }

  const base =
    ctx.baseThemes.find((t) => t.id === shown) ??
    ctx.baseThemes[0] ??
    ctx.resolved.theme;
  const variant =
    ctx.pref.ui?.theme === base.id ? ctx.pref.ui.variant : ctx.resolved.variant;
  const out: CustomTheme = { id, label };
  if (ctx.style !== undefined && ctx.style !== DEFAULT_STYLE) {
    out.style = ctx.style;
  }
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
 * A copy of what the terminal shows. A base theme (UI or terminal-only): each
 * scheme it has becomes a based side on it, with the current variant where
 * that palette defines it. A terminal custom theme: its sides. A UI custom
 * theme cannot be a base, so each of its sides becomes Fully custom from the
 * terminal colours it shows.
 */
function newTerminalTheme(ctx: NewTerminalThemeContext): CustomTerminalTheme {
  const id = newThemeId(takenIds(ctx));
  const label = uniqueLabel("Terminal theme", ctx.labels);
  const { theme, following } = ctx.terminal;
  const custom = ctx.customs.find((c) => c.id === theme.id);
  if (custom !== undefined && isCustomTerminalTheme(custom)) {
    return { id, kind: "terminal", label, ...copySides(custom) };
  }
  const out: CustomTerminalTheme = { id, kind: "terminal", label };
  const pick = following ? ctx.pref.ui : ctx.pref.terminal;
  const variant =
    pick?.theme === theme.id && pick.variant !== undefined
      ? pick.variant
      : ctx.terminal.variant;
  for (const scheme of schemesOf(theme)) {
    const palette = theme[scheme];
    if (palette === undefined) continue;
    if (custom !== undefined) {
      out[scheme] = { tokens: { ...palette.terminal } };
      continue;
    }
    out[scheme] = {
      base: baseRef({
        theme: theme.id,
        variant: Object.hasOwn(palette.variants ?? {}, variant)
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
