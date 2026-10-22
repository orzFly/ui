import {
  type AnyCustomTheme,
  builtinThemes,
  type CustomTerminalTheme,
  type CustomTheme,
  dracula,
  nord,
  resolvePalette,
  resolveTerminal,
  solarized,
  TERMINAL_TOKEN_NAMES,
  type TerminalTokens,
  TOKEN_NAMES,
  type Tokens,
} from "@orz/themes";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  canFollow,
  composeDraft,
  type DraftAction,
  type DraftState,
  draftReducer,
  duplicate,
  fallbackBase,
  initDraftState,
  isDirty,
  isOverridden,
  isTerminalOverridden,
  newTheme,
  newThemeId,
  overrideCount,
  sameTerminal,
  sideMode,
  terminalMode,
  terminalOverrideCount,
  useThemeDraft,
} from "../src/components/theme-editor/draft.ts";
import {
  groupTokens,
  rowTokens,
  TERMINAL_CONTRAST_WITH,
  TERMINAL_TOKEN_GROUPS,
  type TokenGroup,
  UI_CONTRAST_WITH,
  UI_TOKEN_GROUPS,
} from "../src/components/theme-editor/tokens.ts";
import { ink } from "./theme-helpers.ts";

const themes = [...builtinThemes, ink];
const PRIMARY = "oklch(0.6 0.18 40)";

const based: CustomTheme = {
  id: "custom-sample",
  label: "Sample",
  light: { base: { theme: "solarized" }, tokens: { primary: PRIMARY } },
  dark: { base: { theme: "nord" } },
};

const run = <C extends AnyCustomTheme>(
  state: DraftState<C>,
  ...actions: DraftAction[]
) => actions.reduce<DraftState<C>>(draftReducer, state);
const start = <C extends AnyCustomTheme>(draft: C, saved: C | null = draft) =>
  initDraftState({ draft, saved });
/** What the side shows now, as the editor passes it. */
const shown = (state: DraftState<CustomTheme>, scheme: "light" | "dark") => {
  const palette = composeDraft(state.draft, themes)?.[scheme];
  if (!palette) throw new Error(`no ${scheme} side`);
  return { tokens: palette.tokens, terminal: palette.terminal };
};

describe("token groups", () => {
  it("cover every UI token exactly once", () => {
    const names = UI_TOKEN_GROUPS.flatMap(groupTokens);
    expect(names).toHaveLength(TOKEN_NAMES.length);
    expect(new Set(names)).toEqual(new Set(TOKEN_NAMES));
  });

  it("cover every terminal token exactly once", () => {
    const names = TERMINAL_TOKEN_GROUPS.flatMap(groupTokens);
    expect(names).toHaveLength(TERMINAL_TOKEN_NAMES.length);
    expect(new Set(names)).toEqual(new Set(TERMINAL_TOKEN_NAMES));
  });

  it("give every single token a surface to contrast with", () => {
    const singles = (groups: readonly TokenGroup<string>[]) =>
      groups
        .flatMap((g) => g.rows)
        .filter((row) => row.kind !== "pair")
        .flatMap((row) => rowTokens(row).map((t) => t.name));
    const contrastless = (
      groups: readonly TokenGroup<string>[],
      map: Readonly<Record<string, string | undefined>>,
    ) => singles(groups).filter((name) => map[name] === undefined);
    expect(contrastless(UI_TOKEN_GROUPS, UI_CONTRAST_WITH)).toEqual([]);
    expect(contrastless(TERMINAL_TOKEN_GROUPS, TERMINAL_CONTRAST_WITH)).toEqual(
      [],
    );
    expect(UI_CONTRAST_WITH["sidebar-ring"]).toBe("sidebar");
    expect(TERMINAL_CONTRAST_WITH["ansi-bright-red"]).toBe(
      "terminal-background",
    );
  });
});

describe("side modes", () => {
  it("Based → Fully custom copies what the side shows, then → Based restores base and overrides", () => {
    let state = start(based);
    const before = shown(state, "light");
    state = run(state, {
      type: "setSideMode",
      scheme: "light",
      mode: "detached",
      resolved: before,
    });
    expect(sideMode(state.draft, "light")).toBe("detached");
    expect(state.draft.light).toEqual({
      tokens: before.tokens,
      terminal: { tokens: before.terminal },
    });
    expect(shown(state, "light")).toEqual(before);

    state = run(
      state,
      { type: "setToken", scheme: "light", name: "ring", value: "#123456" },
      { type: "setSideMode", scheme: "light", mode: "based" },
    );
    expect(state.draft.light).toEqual(based.light);

    // The detached colours are kept in the session too.
    state = run(state, {
      type: "setSideMode",
      scheme: "light",
      mode: "detached",
      resolved: shown(state, "light"),
    });
    expect(state.draft.light?.tokens?.ring).toBe("#123456");
  });

  it("Based → Fully custom keeps a terminal that names a palette", () => {
    const terminal = {
      base: { theme: "ink" },
      tokens: { "ansi-red": "#ff0000" },
    };
    let state = start({
      ...based,
      dark: { base: { theme: "nord" }, terminal },
    });
    state = run(state, {
      type: "setSideMode",
      scheme: "dark",
      mode: "detached",
      resolved: shown(state, "dark"),
    });
    expect(state.draft.dark?.terminal).toEqual(terminal);
    expect(terminalMode(state.draft, "dark")).toBe("based");
  });

  it("Fully custom → Based with nothing remembered takes the given base, no overrides", () => {
    const tokens = resolvePalette(nord, "dark")?.tokens as Tokens;
    const terminal = nord.dark?.terminal as TerminalTokens;
    let state = start({
      id: "custom-x",
      label: "X",
      dark: { tokens, terminal: { tokens: terminal } },
    });
    // No base given and none remembered: nothing to do.
    expect(
      run(state, { type: "setSideMode", scheme: "dark", mode: "based" }),
    ).toBe(state);
    state = run(state, {
      type: "setSideMode",
      scheme: "dark",
      mode: "based",
      base: fallbackBase("dark", "solarized", builtinThemes),
    });
    expect(state.draft.dark).toEqual({ base: { theme: "solarized" } });
  });

  it("→ None and back keeps the side's content", () => {
    let state = start(based);
    state = run(state, { type: "setSideMode", scheme: "light", mode: "none" });
    expect(state.draft.light).toBeUndefined();
    expect(sideMode(state.draft, "light")).toBe("none");
    expect(terminalMode(state.draft, "light")).toBeNull();
    state = run(state, { type: "setSideMode", scheme: "light", mode: "based" });
    expect(state.draft).toEqual(based);
  });

  it("composes to null when both sides are None", () => {
    const state = run(
      start(based),
      { type: "setSideMode", scheme: "light", mode: "none" },
      { type: "setSideMode", scheme: "dark", mode: "none" },
    );
    expect(composeDraft(state.draft, themes)).toBeNull();
  });
});

describe("overrides", () => {
  it("a base or variant change keeps the overrides", () => {
    const state = run(
      start(based),
      { type: "setBase", scheme: "light", base: { theme: "github" } },
      { type: "setVariant", scheme: "light", variant: "amoled" },
    );
    expect(state.draft.light).toEqual({
      base: { theme: "github", variant: "amoled" },
      tokens: { primary: PRIMARY },
    });
    const reset = run(state, {
      type: "setVariant",
      scheme: "light",
      variant: "default",
    });
    expect(reset.draft.light).toEqual({
      base: { theme: "github" },
      tokens: { primary: PRIMARY },
    });
  });

  it("an override equal to the base value stays", () => {
    const state = run(start(based), {
      type: "setToken",
      scheme: "dark",
      name: "background",
      value: nord.dark?.tokens.background as string,
    });
    expect(isOverridden(state.draft, "dark", "background")).toBe(true);
    expect(overrideCount(state.draft, "dark")).toBe(1);
  });

  it("↺ removes one override and Reset all clears them", () => {
    let state = run(start(based), {
      type: "setToken",
      scheme: "light",
      name: "ring",
      value: "#123456",
    });
    expect(overrideCount(state.draft, "light")).toBe(2);
    expect(overrideCount(state.draft, "light", ["ring", "border"])).toBe(1);
    state = run(state, { type: "resetToken", scheme: "light", name: "ring" });
    expect(state.draft.light).toEqual(based.light);
    state = run(state, { type: "resetAll", scheme: "light" });
    expect(state.draft.light).toEqual({ base: { theme: "solarized" } });
    expect(isOverridden(state.draft, "light", "primary")).toBe(false);
    state = run(state, {
      type: "resetToken",
      scheme: "light",
      name: "primary",
    });
    expect(state.draft.light).toEqual({ base: { theme: "solarized" } });
  });

  it("a fully custom side counts no overrides", () => {
    const state = run(start(based), {
      type: "setSideMode",
      scheme: "dark",
      mode: "detached",
      resolved: shown(start(based), "dark"),
    });
    expect(overrideCount(state.draft, "dark")).toBe(0);
    expect(isOverridden(state.draft, "dark", "background")).toBe(false);
  });
});

describe("terminal", () => {
  it("counts following terminals as shared only on the same base", () => {
    expect(sameTerminal(based)).toBe(false);
    const solar = { base: { theme: "solarized" } };
    expect(sameTerminal({ ...based, light: solar, dark: solar })).toBe(true);
    expect(
      sameTerminal({
        ...based,
        light: solar,
        dark: { base: { theme: "solarized", variant: "amoled" } },
      }),
    ).toBe(false);
    expect(canFollow({ ...based, light: solar, dark: solar }, "both")).toBe(
      true,
    );
    expect(canFollow(based, "both")).toBe(false);
  });

  it("a pin through the shared control keeps one terminal", () => {
    const solar = { base: { theme: "solarized" } };
    const state = run(
      start<CustomTheme>({ ...based, light: solar, dark: solar }),
      {
        type: "setTerminalToken",
        target: "both",
        name: "ansi-red",
        value: "#ff0000",
      },
    );
    expect(state.draft.light?.terminal).toEqual({
      base: { theme: "solarized" },
      tokens: { "ansi-red": "#ff0000" },
    });
    expect(sameTerminal(state.draft)).toBe(true);
  });

  it("sharing terminals that follow different bases names the source's base", () => {
    const state = run(start(based), { type: "shareTerminal", from: "dark" });
    expect(state.draft.light?.terminal).toEqual({ base: { theme: "nord" } });
    expect(state.draft.dark?.terminal).toEqual({ base: { theme: "nord" } });
    expect(sameTerminal(state.draft)).toBe(true);
  });

  it("a mode switch for both writes the first side's terminal to each", () => {
    let state = start(based);
    for (const [scheme, colour] of [
      ["light", "#111111"],
      ["dark", "#222222"],
    ] as const) {
      state = run(
        state,
        {
          type: "setTerminalMode",
          target: scheme,
          mode: "detached",
          resolved: shown(state, scheme).terminal,
        },
        {
          type: "setTerminalToken",
          target: scheme,
          name: "ansi-red",
          value: colour,
        },
        {
          type: "setTerminalMode",
          target: scheme,
          mode: "based",
          base: { theme: "ink" },
        },
      );
    }
    expect(sameTerminal(state.draft)).toBe(true);
    state = run(state, {
      type: "setTerminalMode",
      target: "both",
      mode: "detached",
    });
    expect(state.draft.light?.terminal).toEqual(state.draft.dark?.terminal);
    expect(state.draft.dark?.terminal).toMatchObject({
      tokens: { "ansi-red": "#111111" },
    });
  });

  it("same terminal for both sides writes both", () => {
    let state = start(based);
    state = run(
      state,
      {
        type: "setTerminalMode",
        target: "both",
        mode: "based",
        base: { theme: "ink", variant: "default" },
      },
      {
        type: "setTerminalToken",
        target: "both",
        name: "ansi-red",
        value: "#ff0000",
      },
    );
    const terminal = {
      base: { theme: "ink" },
      tokens: { "ansi-red": "#ff0000" },
    };
    expect(state.draft.light?.terminal).toEqual(terminal);
    expect(state.draft.dark?.terminal).toEqual(terminal);
    expect(sameTerminal(state.draft)).toBe(true);
    expect(terminalOverrideCount(state.draft, "dark")).toBe(1);
    expect(isTerminalOverridden(state.draft, "light", "ansi-red")).toBe(true);
  });

  it("turning it off splits the sides", () => {
    const state = run(
      start(based),
      {
        type: "setTerminalMode",
        target: "both",
        mode: "based",
        base: { theme: "ink" },
      },
      {
        type: "setTerminalBase",
        target: "dark",
        base: { theme: "dracula", scheme: "dark" },
      },
    );
    expect(state.draft.light?.terminal).toEqual({ base: { theme: "ink" } });
    expect(state.draft.dark?.terminal).toEqual({
      base: { theme: "dracula", scheme: "dark" },
    });
    expect(sameTerminal(state.draft)).toBe(false);

    const shared = run(state, { type: "shareTerminal", from: "dark" });
    expect(shared.draft.light?.terminal).toEqual(shared.draft.dark?.terminal);
  });

  it("a detached side cannot pick Follow", () => {
    let state = start(based);
    state = run(state, {
      type: "setSideMode",
      scheme: "dark",
      mode: "detached",
      resolved: shown(state, "dark"),
    });
    expect(canFollow(state.draft, "dark")).toBe(false);
    expect(canFollow(state.draft, "light")).toBe(true);
    expect(
      run(state, { type: "setTerminalMode", target: "dark", mode: "follow" }),
    ).toBe(state);

    // Sharing a following terminal onto it detaches both from the shown colours.
    const terminal = shown(state, "light").terminal;
    const shared = run(state, {
      type: "shareTerminal",
      from: "light",
      resolved: terminal,
    });
    expect(shared.draft.light?.terminal).toEqual({ tokens: terminal });
    expect(shared.draft.dark?.terminal).toEqual({ tokens: terminal });
  });

  it("switching terminal modes restores what each had this session", () => {
    let state = start(based);
    state = run(
      state,
      {
        type: "setTerminalMode",
        target: "light",
        mode: "based",
        base: { theme: "ink" },
      },
      { type: "setTerminalVariant", target: "light", variant: "amoled" },
      {
        type: "setTerminalMode",
        target: "light",
        mode: "detached",
        resolved: shown(state, "light").terminal,
      },
    );
    expect(terminalMode(state.draft, "light")).toBe("detached");
    state = run(state, {
      type: "setTerminalMode",
      target: "light",
      mode: "based",
    });
    expect(state.draft.light?.terminal).toEqual({
      base: { theme: "ink", variant: "amoled" },
    });
    state = run(state, {
      type: "setTerminalMode",
      target: "light",
      mode: "follow",
    });
    expect(state.draft.light).toEqual(based.light);
  });

  it("editing a following terminal pins the colour on the base's own terminal", () => {
    const before = start(based);
    const state = run(before, {
      type: "setTerminalToken",
      target: "dark",
      name: "ansi-red",
      value: "#ff0000",
    });
    expect(state.draft.dark?.terminal).toEqual({
      base: { theme: "nord" },
      tokens: { "ansi-red": "#ff0000" },
    });
    expect(shown(state, "dark").terminal).toEqual({
      ...shown(before, "dark").terminal,
      "ansi-red": "#ff0000",
    });
  });
});

describe("dirty", () => {
  it("compares a stored theme's draft with what was saved", () => {
    let state = start(based);
    expect(isDirty(state)).toBe(false);
    state = run(state, { type: "setLabel", label: "Other" });
    expect(isDirty(state)).toBe(true);
    state = run(state, { type: "setLabel", label: "Sample" });
    expect(isDirty(state)).toBe(false);
    state = run(state, { type: "setLabel", label: "Saved" });
    state = run(state, { type: "markSaved", saved: state.draft });
    expect(isDirty(state)).toBe(false);
    expect(state.saved?.label).toBe("Saved");
  });

  it("makes a new theme dirty once any action ran", () => {
    let state = start(based, null);
    expect(isDirty(state)).toBe(false);
    state = run(state, { type: "resetAll", scheme: "dark" });
    expect(isDirty(state)).toBe(false);
    state = run(state, { type: "setLabel", label: "Sample 2" });
    expect(isDirty(state)).toBe(true);
    state = run(state, { type: "load", draft: based, saved: based });
    expect(isDirty(state)).toBe(false);
    expect(state.memory).toEqual({});
  });
});

describe("useThemeDraft", () => {
  it("dispatches and composes the draft", () => {
    const { result } = renderHook(() =>
      useThemeDraft({ draft: based, saved: based }, themes),
    );
    expect(result.current.dirty).toBe(false);
    expect(result.current.composed?.light?.tokens.primary).toBe(PRIMARY);
    act(() =>
      result.current.dispatch({
        type: "setToken",
        scheme: "light",
        name: "primary",
        value: "#abcdef",
      }),
    );
    expect(result.current.dirty).toBe(true);
    expect(result.current.composed?.light?.tokens.primary).toBe("#abcdef");
  });

  it("composes an unnamed draft under a placeholder label", () => {
    expect(composeDraft({ ...based, label: "  " }, themes)?.label).toBe(
      "Untitled theme",
    );
  });
});

describe("new themes", () => {
  const labels = [...builtinThemes.map((t) => t.label), "Custom theme"];

  it("starts from the base theme the page shows, with the variant where defined", () => {
    const theme = newTheme({
      pref: { ui: { theme: "dracula", mode: "dark", variant: "amoled" } },
      resolved: { theme: dracula, variant: "amoled" },
      baseThemes: builtinThemes,
      customs: [],
      labels,
    });
    expect(theme.id).toMatch(/^custom-[0-9a-z]{8}$/);
    expect(theme.label).toBe("Custom theme (2)");
    expect(theme.dark).toEqual({
      base: { theme: "dracula", variant: "amoled" },
    });
    expect(theme.light).toBeUndefined();

    const two = newTheme({
      pref: { ui: { theme: "solarized", mode: "system", variant: "amoled" } },
      resolved: { theme: solarized, variant: "default" },
      baseThemes: builtinThemes,
      customs: [],
      labels: [],
    });
    expect(two.label).toBe("Custom theme");
    const variants = (s: "light" | "dark") =>
      Object.hasOwn(solarized[s]?.variants ?? {}, "amoled")
        ? { theme: "solarized", variant: "amoled" }
        : { theme: "solarized" };
    expect(two.light).toEqual({ base: variants("light") });
    expect(two.dark).toEqual({ base: variants("dark") });
  });

  it("copies a custom theme's sides", () => {
    const shown = composeDraft(based, themes);
    if (!shown) throw new Error("composes");
    const theme = newTheme({
      pref: { ui: { theme: based.id, mode: "light" } },
      resolved: { theme: shown, variant: "default" },
      baseThemes: builtinThemes,
      customs: [based],
      labels: [based.label],
    });
    expect(theme.id).not.toBe(based.id);
    expect(theme.label).toBe("Custom theme");
    expect({ ...theme, id: based.id, label: based.label }).toEqual(based);
    expect(theme.light).not.toBe(based.light);
  });

  it("names a duplicate '<label> copy', numbered until free", () => {
    const ctx = {
      baseThemes: builtinThemes,
      customs: [based],
      labels: ["Sample", "sample COPY"],
    };
    const copy = duplicate(based, ctx);
    expect(copy.label).toBe("Sample copy (2)");
    expect(copy.light).toEqual(based.light);
    expect(copy.id).not.toBe(based.id);
  });

  it("regenerates an id that clashes", () => {
    const values = [
      new Uint8Array(8).fill(0),
      new Uint8Array(8).fill(255),
      new Uint8Array(8).fill(1),
    ];
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).set(values.shift() as Uint8Array);
      return array;
    });
    expect(newThemeId(["custom-00000000"])).toBe("custom-11111111");
    vi.restoreAllMocks();
  });

  it("falls back to the first base theme with the scheme", () => {
    expect(fallbackBase("light", "dracula", builtinThemes)?.theme).not.toBe(
      "dracula",
    );
    expect(fallbackBase("dark", "dracula", builtinThemes)).toEqual({
      theme: "dracula",
    });
  });
});

describe("terminal themes", () => {
  const glow: CustomTerminalTheme = {
    id: "custom-glow",
    kind: "terminal",
    label: "Glow",
    dark: { base: { theme: "ink" }, tokens: { "ansi-red": "#ff3344" } },
  };
  const nordDark = resolveTerminal(nord, "dark")?.terminal as TerminalTokens;

  it("switches None · Based · Fully custom per side, keeping each form for the session", () => {
    let state = start(glow);
    const before = composeDraft(glow, themes)?.dark?.terminal;
    state = run(state, {
      type: "setTerminalMode",
      target: "dark",
      mode: "detached",
      resolved: before,
    });
    expect(state.draft.dark).toEqual({ tokens: before });
    expect(sideMode(state.draft, "dark")).toBe("detached");
    expect(terminalMode(state.draft, "dark")).toBe("detached");

    state = run(
      state,
      {
        type: "setTerminalToken",
        target: "dark",
        name: "ansi-blue",
        value: "#0000ff",
      },
      { type: "setTerminalMode", target: "dark", mode: "based" },
    );
    expect(state.draft.dark).toEqual(glow.dark);

    state = run(state, {
      type: "setTerminalMode",
      target: "dark",
      mode: "none",
    });
    expect(state.draft).not.toHaveProperty("dark");
    expect(terminalMode(state.draft, "dark")).toBeNull();
    state = run(state, {
      type: "setTerminalMode",
      target: "dark",
      mode: "detached",
    });
    expect(state.draft.dark).toEqual({
      tokens: { ...before, "ansi-blue": "#0000ff" },
    });
  });

  it("adds a side from None on the given base, and ignores Follow and both", () => {
    let state = start(glow);
    const ignored = run(
      state,
      { type: "setTerminalMode", target: "dark", mode: "follow" },
      {
        type: "setTerminalMode",
        target: "both",
        mode: "detached",
        resolved: nordDark,
      },
      { type: "setSideMode", scheme: "dark", mode: "none" },
      { type: "setBase", scheme: "dark", base: { theme: "nord" } },
    );
    expect(ignored.draft).toEqual(glow);
    expect(isDirty(ignored)).toBe(false);

    state = run(state, {
      type: "setTerminalMode",
      target: "light",
      mode: "based",
      base: { theme: "nord", scheme: "dark" },
    });
    expect(state.draft.light).toEqual({
      base: { theme: "nord", scheme: "dark" },
    });
    expect(composeDraft(state.draft, themes)?.light?.terminal).toEqual(
      nordDark,
    );
  });

  it("composes to null when both sides are None", () => {
    const state = run(start(glow), {
      type: "setTerminalMode",
      target: "dark",
      mode: "none",
    });
    expect(state.draft).toEqual({
      id: glow.id,
      kind: "terminal",
      label: glow.label,
    });
    expect(composeDraft(state.draft, themes)).toBeNull();
  });

  it("keeps overrides across palette and variant changes; ↺ and Reset all remove them", () => {
    let state = run(
      start(glow),
      {
        type: "setTerminalBase",
        target: "dark",
        base: { theme: "dracula" },
      },
      { type: "setTerminalVariant", target: "dark", variant: "amoled" },
      {
        type: "setTerminalToken",
        target: "dark",
        name: "ansi-green",
        value: "#00ff00",
      },
    );
    expect(state.draft.dark).toEqual({
      base: { theme: "dracula", variant: "amoled" },
      tokens: { "ansi-red": "#ff3344", "ansi-green": "#00ff00" },
    });
    expect(isTerminalOverridden(state.draft, "dark", "ansi-red")).toBe(true);
    expect(terminalOverrideCount(state.draft, "dark")).toBe(2);

    state = run(state, {
      type: "resetTerminalToken",
      target: "dark",
      name: "ansi-red",
    });
    expect(terminalOverrideCount(state.draft, "dark")).toBe(1);
    state = run(state, { type: "resetAllTerminal", target: "dark" });
    expect(state.draft.dark).toEqual({
      base: { theme: "dracula", variant: "amoled" },
    });
  });

  it("dispatches composeDraft to a terminal palette with no UI tokens", () => {
    const composed = composeDraft({ ...glow, label: " " }, themes);
    expect(composed?.label).toBe("Untitled theme");
    expect(composed?.dark).toEqual({
      terminal: {
        ...ink.dark?.terminal,
        "ansi-red": "#ff3344",
      },
    });
  });

  describe("new terminal themes", () => {
    const ctx = {
      kind: "terminal" as const,
      pref: {},
      baseThemes: builtinThemes,
      labels: ["Terminal theme"],
    };

    it("starts based on the base theme the terminal shows, with the variant where defined", () => {
      const theme = newTheme({
        ...ctx,
        customs: [],
        pref: {
          terminal: { theme: "dracula", mode: "dark", variant: "amoled" },
        },
        terminal: { theme: dracula, variant: "amoled", following: false },
      });
      expect(theme.kind).toBe("terminal");
      expect(theme.label).toBe("Terminal theme (2)");
      expect(theme.dark).toEqual({
        base: { theme: "dracula", variant: "amoled" },
      });
      expect(theme).not.toHaveProperty("light");

      const following = newTheme({
        ...ctx,
        customs: [],
        pref: { ui: { theme: "solarized", mode: "system" } },
        terminal: { theme: solarized, variant: "default", following: true },
      });
      expect(following.light).toEqual({ base: { theme: "solarized" } });
      expect(following.dark).toEqual({ base: { theme: "solarized" } });

      const inky = newTheme({
        ...ctx,
        customs: [],
        terminal: { theme: ink, variant: "default", following: false },
      });
      expect(inky.dark).toEqual({ base: { theme: "ink" } });
    });

    it("copies a terminal custom theme's sides", () => {
      const shownTheme = composeDraft(glow, themes);
      if (!shownTheme) throw new Error("composes");
      const theme = newTheme({
        ...ctx,
        customs: [glow],
        terminal: { theme: shownTheme, variant: "default", following: false },
      });
      expect(theme.id).not.toBe(glow.id);
      expect({ ...theme, id: glow.id, label: glow.label }).toEqual(glow);
      expect(theme.dark).not.toBe(glow.dark);
    });

    it("makes each side of a UI custom theme Fully custom from its terminal", () => {
      const shownTheme = composeDraft(based, themes);
      if (!shownTheme) throw new Error("composes");
      const theme = newTheme({
        ...ctx,
        customs: [based],
        pref: { ui: { theme: based.id, mode: "light" } },
        terminal: { theme: shownTheme, variant: "default", following: true },
      });
      expect(theme.light).toEqual({ tokens: shownTheme.light?.terminal });
      expect(theme.dark).toEqual({ tokens: nordDark });
    });

    it("duplicates with the kind kept", () => {
      const copy = duplicate(glow, {
        baseThemes: builtinThemes,
        customs: [glow],
        labels: ["Glow"],
      });
      expect(copy.kind).toBe("terminal");
      expect(copy.label).toBe("Glow copy");
      expect(copy.dark).toEqual(glow.dark);
    });
  });
});
