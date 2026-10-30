import {
  builtinThemes,
  type CustomTheme,
  defaultStyle,
  dracula,
  solarized,
} from "@orz/themes";
import { describe, expect, it } from "vitest";
import {
  bevelDay,
  bevelNight,
  bevelStyle,
  bothStyles,
  html,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  styledThemes,
  styleText,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const styled = (options: Parameters<typeof store>[0] = {}) =>
  store({ themes: styledThemes, styles: bothStyles, ...options });

describe("styles in the store", () => {
  it("offers the default style alone unless told otherwise, and marks the root", () => {
    stubDarkQuery(false);
    const themes = store();
    expect(themes.getStyles()).toEqual([defaultStyle]);
    expect(themes.getStyle()).toBe("default");
    expect(themes.getPref()).toEqual({
      ui: { theme: "default", mode: "system" },
    });
    expect(themes.getResolved()?.style).toBe("default");
    expect(html.dataset.style).toBe("default");
  });

  it("refuses an empty list and a default style it does not offer", () => {
    expect(() => store({ styles: [] })).toThrow(/styles is empty/);
    expect(() => store({ defaultStyle: "bevel" })).toThrow(
      /defaultStyle bevel is not in styles/,
    );
  });

  it("keeps the UI pick to the style's themes", () => {
    stubDarkQuery(false);
    const themes = styled();
    // Under the default style a bevel theme falls back to the first default one.
    themes.setPref({ ui: { theme: "bevel-day", mode: "dark" } });
    expect(themes.getPref().ui).toEqual({ theme: "default", mode: "system" });
    themes.setPref({
      style: "bevel",
      ui: { theme: "bevel-day", mode: "dark" },
    });
    expect(themes.getPref()).toEqual({
      style: "bevel",
      ui: { theme: "bevel-day", mode: "dark" },
    });
    // And a default theme under bevel falls back to bevel's first.
    themes.setPref({ style: "bevel", ui: { theme: "dracula", mode: "dark" } });
    expect(themes.getPref().ui).toEqual({ theme: "bevel-day", mode: "system" });
  });

  it("reads a style it does not offer as the default style", () => {
    stubDarkQuery(false);
    const themes = store();
    themes.setPref({ style: "bevel", ui: { theme: "nord", mode: "dark" } });
    expect(themes.getPref()).toEqual({ ui: { theme: "nord", mode: "dark" } });
    expect(html.dataset.style).toBe("default");
  });

  it("starts a user who never picked on the app's default style, and leaves it out of the pref", () => {
    stubDarkQuery(false);
    const themes = styled({ defaultStyle: "bevel" });
    expect(themes.getStyle()).toBe("bevel");
    expect(themes.getPref()).toEqual({
      ui: { theme: "bevel-day", mode: "system" },
    });
    expect(html.dataset.style).toBe("bevel");
    themes.setStyle("default");
    expect(themes.getPref().style).toBe("default");
  });

  it("holds the user to one style when it is the only one offered", () => {
    stubDarkQuery(false);
    const themes = store({ themes: styledThemes, styles: [bevelStyle] });
    expect(themes.getStyle()).toBe("bevel");
    expect(themes.getResolved()?.theme).toBe(bevelDay);
    expect(() => themes.setStyle("default")).toThrow(/not offered/);
  });

  it("shows every theme under a style with none of its own", () => {
    stubDarkQuery(false);
    const themes = store({ styles: bothStyles });
    themes.setStyle("bevel");
    expect(themes.getPref()).toMatchObject({
      style: "bevel",
      ui: { theme: "default", mode: "system" },
    });
  });
});

describe("setStyle", () => {
  it("remembers the pick under the old style and restores it on the way back", () => {
    stubDarkQuery(false);
    const themes = styled();
    themes.setPref({
      ui: { theme: "solarized", mode: "dark", variant: "amoled" },
    });
    themes.setStyle("bevel");
    // Bevel was never visited: its first theme, in the current mode.
    expect(themes.getPref()).toEqual({
      style: "bevel",
      ui: { theme: "bevel-day", mode: "dark" },
      uiByStyle: {
        default: { theme: "solarized", mode: "dark", variant: "amoled" },
      },
    });
    expect(html.dataset.style).toBe("bevel");
    themes.setPref({
      ...themes.getPref(),
      ui: { theme: "bevel-night", mode: "dark" },
    });
    themes.setStyle("default");
    expect(themes.getPref()).toEqual({
      ui: { theme: "solarized", mode: "dark", variant: "amoled" },
      uiByStyle: { bevel: { theme: "bevel-night", mode: "dark" } },
    });
    expect(html.dataset.style).toBe("default");
    themes.setStyle("bevel");
    expect(themes.getPref().ui).toEqual({ theme: "bevel-night", mode: "dark" });
  });

  it("falls back to the style's first theme when the remembered one is gone", () => {
    stubDarkQuery(false);
    const themes = styled();
    themes.setPref({
      ui: { theme: "vs", mode: "light" },
      uiByStyle: { bevel: { theme: "bevel-gone", mode: "dark" } },
    });
    themes.setStyle("bevel");
    expect(themes.getPref().ui).toEqual({ theme: "bevel-day", mode: "light" });
  });

  it("keeps the terminal's own pick, and a following terminal takes the new palette", () => {
    stubDarkQuery(true);
    const themes = styled({ terminalThemes: builtinThemes });
    themes.setStyle("bevel");
    expect(themes.getTerminal()).toMatchObject({
      following: true,
      theme: bevelDay,
      tokens: bevelDay.dark?.terminal,
    });
    themes.setPref({
      ...themes.getPref(),
      terminal: { theme: "dracula", mode: "dark" },
    });
    themes.setStyle("default");
    expect(themes.getPref().terminal).toEqual({
      theme: "dracula",
      mode: "dark",
    });
  });

  it("paints the palette's style tokens, and drops them with the style", () => {
    stubDarkQuery(true);
    const themes = styled();
    themes.setStyle("bevel");
    expect(styleText()).toContain("--3d-face: #404040;");
    themes.setStyle("default");
    expect(styleText()).not.toContain("--3d-face");
  });

  it("refuses a style it does not offer, and a store with no UI slot", () => {
    expect(() => styled().setStyle("chrome")).toThrow(/not offered/);
    expect(() =>
      store({ themes: undefined, terminalThemes: builtinThemes }).setStyle(
        "default",
      ),
    ).toThrow(/no UI slot/);
  });
});

describe("previewing a style", () => {
  it("shows where switching would land, without committing it", () => {
    stubDarkQuery(false);
    const themes = styled();
    themes.setPref({
      ui: { theme: "nord", mode: "dark" },
      uiByStyle: { bevel: { theme: "bevel-night", mode: "dark" } },
    });
    const pref = themes.getPref();
    themes.preview({ style: "bevel" });
    expect(themes.getResolved()).toMatchObject({
      theme: bevelNight,
      style: "bevel",
    });
    expect(html.dataset.style).toBe("bevel");
    expect(themes.getPref()).toBe(pref);
    expect(localStorage.getItem("app-theme-paint")).not.toContain("bevel");
    themes.preview(null);
    expect(themes.getResolved()?.style).toBe("default");
    expect(html.dataset.style).toBe("default");
  });

  it("ignores a style it does not offer", () => {
    stubDarkQuery(false);
    const themes = styled();
    themes.preview({ style: "chrome" });
    expect(themes.getResolved()?.style).toBe("default");
  });
});

describe("persisting the style", () => {
  it("stores the style and the remembered picks, and reads them back", () => {
    stubDarkQuery(false);
    styled().setPref({ ui: { theme: "dracula", mode: "dark" } });
    styled().setStyle("bevel");
    expect(JSON.parse(localStorage.getItem("app-theme") ?? "")).toEqual({
      style: "bevel",
      ui: { theme: "bevel-day", mode: "dark" },
      uiByStyle: { default: { theme: "dracula", mode: "dark" } },
    });
    const reloaded = styled();
    expect(reloaded.getStyle()).toBe("bevel");
    expect(html.dataset.style).toBe("bevel");
    reloaded.setStyle("default");
    expect(reloaded.getResolved()?.theme).toBe(dracula);
  });

  it("drops a remembered pick that is no pick", () => {
    stubDarkQuery(false);
    localStorage.setItem(
      "app-theme",
      JSON.stringify({
        ui: { theme: "nord", mode: "dark" },
        uiByStyle: { bevel: { mode: "dark" }, default: { theme: "vs" } },
      }),
    );
    // The current style's own entry goes too: `ui` is its pick.
    expect(styled().getPref()).toEqual({ ui: { theme: "nord", mode: "dark" } });
  });

  it("shows the painted style until the app's first setPref, when the app owns the pref", () => {
    stubDarkQuery(false);
    styled().setStyle("bevel");
    const themes = styled({ persistPref: false });
    expect(themes.getStyle()).toBe("bevel");
  });
});

describe("custom themes and styles", () => {
  const onBevel: CustomTheme = {
    id: "custom-on-bevel",
    label: "On bevel",
    light: { base: { theme: "bevel-day" } },
  };
  const solarizedLight = solarized.light;
  const madeUnderBevel: CustomTheme = {
    id: "custom-made-under-bevel",
    label: "Made under bevel",
    style: "bevel",
    light: {
      tokens: solarizedLight?.tokens as NonNullable<
        typeof solarizedLight
      >["tokens"],
      terminal: { base: { theme: "solarized" } },
    },
  };

  it("lists a custom theme under its base's styles, or the style it was made under", () => {
    stubDarkQuery(false);
    const themes = styled();
    themes.setCustomThemes([onBevel, madeUnderBevel]);
    themes.setPref({ ui: { theme: "custom-on-bevel", mode: "light" } });
    expect(themes.getPref().ui?.theme).toBe("default");
    themes.setPref({
      style: "bevel",
      ui: { theme: "custom-on-bevel", mode: "light" },
    });
    expect(themes.getPref().ui?.theme).toBe("custom-on-bevel");
    expect(styleText()).toContain("--3d-face: #d4d0c8;");
    themes.setPref({
      style: "bevel",
      ui: { theme: "custom-made-under-bevel", mode: "light" },
    });
    expect(themes.getPref().ui?.theme).toBe("custom-made-under-bevel");
  });
});
