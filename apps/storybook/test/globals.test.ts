import { builtinThemes, schemesOf, variantsOf } from "@orz/themes";
import {
  normalizePref,
  type ThemeMode,
  type ThemePick,
  type ThemePref,
} from "@orz/ui/theme";
import { describe, expect, it } from "vitest";
import {
  changedGlobals,
  decodePick,
  encodePick,
  prefOf,
  type Slot,
  urlGlobals,
} from "../.storybook/globals.ts";

const DEFAULT = builtinThemes[0].id;
const slots = { themes: builtinThemes, terminalThemes: builtinThemes };
const normalized = (pref: ThemePref) => normalizePref(pref, slots);

const pick = (theme: string, mode: ThemeMode, variant?: string): ThemePick =>
  variant === undefined ? { theme, mode } : { theme, mode, variant };

// What the toolbar dropdowns offered before the real ThemeMenu, and the pick
// preview.tsx's prefOf made of each. Written out by hand: preview.tsx paints on
// import, so it cannot be loaded here.
const LEGACY_THEME: [string, ThemePick][] = [
  ["system", pick("default", "system")],
  ["default_light", pick("default", "light")],
  ["default_dark", pick("default", "dark")],
  ["picotera_light", pick("picotera", "light")],
  ["picotera_dark", pick("picotera", "dark")],
  ["solarized_light", pick("solarized", "light")],
  ["solarized_dark", pick("solarized", "dark")],
  ["vs_light", pick("vs", "light")],
  ["vs_dark", pick("vs", "dark")],
  ["github_light", pick("github", "light")],
  ["github_dark", pick("github", "dark")],
  ["catppuccin_light", pick("catppuccin", "light")],
  ["catppuccin_dark", pick("catppuccin", "dark")],
  ["gruvbox_light", pick("gruvbox", "light")],
  ["gruvbox_dark", pick("gruvbox", "dark")],
  ["dracula_dark", pick("dracula", "dark")],
  ["nord_dark", pick("nord", "dark")],
  ["tokyo-night_dark", pick("tokyo-night", "dark")],
  ["one-dark_dark", pick("one-dark", "dark")],
  ["monokai_dark", pick("monokai", "dark")],
  ["default_dark_amoled", pick("default", "dark", "amoled")],
  ["picotera_dark_amoled", pick("picotera", "dark", "amoled")],
  ["solarized_dark_amoled", pick("solarized", "dark", "amoled")],
  ["vs_dark_amoled", pick("vs", "dark", "amoled")],
  ["github_dark_amoled", pick("github", "dark", "amoled")],
  ["catppuccin_dark_amoled", pick("catppuccin", "dark", "amoled")],
  ["gruvbox_dark_amoled", pick("gruvbox", "dark", "amoled")],
  ["dracula_dark_amoled", pick("dracula", "dark", "amoled")],
  ["nord_dark_amoled", pick("nord", "dark", "amoled")],
  ["tokyo-night_dark_amoled", pick("tokyo-night", "dark", "amoled")],
  ["one-dark_dark_amoled", pick("one-dark", "dark", "amoled")],
  ["monokai_dark_amoled", pick("monokai", "dark", "amoled")],
];
// The terminal dropdown had "follow" and the plain palettes, no AMOLED.
const LEGACY_TERMINAL: [string, ThemePick | undefined][] = [
  ["follow", undefined],
  ...LEGACY_THEME.filter(
    ([value]) => value !== "system" && !value.endsWith("_amoled"),
  ),
];

/** Every pick ThemeMenu can commit on the built-ins, normalized. */
function everyPick(): ThemePick[] {
  const out: ThemePick[] = [];
  for (const theme of builtinThemes) {
    const schemes = schemesOf(theme);
    const modes: ThemeMode[] =
      schemes.length === 2 ? [...schemes, "system"] : schemes;
    for (const mode of modes) {
      for (const { id } of variantsOf(theme)) {
        const ui = normalized({ ui: pick(theme.id, mode, id) }).ui;
        if (ui && !out.some((p) => JSON.stringify(p) === JSON.stringify(ui)))
          out.push(ui);
      }
    }
  }
  return out;
}

describe("legacy globals", () => {
  it.each(LEGACY_THEME)("theme %s decodes as before, and back", (value, p) => {
    expect(decodePick(value, "ui", DEFAULT)).toEqual(p);
    expect(encodePick(normalized({ ui: p }).ui, "ui", DEFAULT)).toBe(value);
  });

  it.each(LEGACY_TERMINAL)(
    "terminal %s decodes as before, and back",
    (value, p) => {
      expect(decodePick(value, "terminal", DEFAULT)).toEqual(p);
      const terminal = normalized({
        ui: pick(DEFAULT, "system"),
        terminal: p,
      }).terminal;
      expect(encodePick(terminal, "terminal", DEFAULT)).toBe(value);
    },
  );

  it("reads both globals at once, a missing one as its initial value", () => {
    expect(
      prefOf({ theme: "nord_dark", terminal: "github_light" }, DEFAULT),
    ).toEqual({
      ui: pick("nord", "dark"),
      terminal: pick("github", "light"),
    });
    expect(prefOf({}, DEFAULT)).toEqual({ ui: pick(DEFAULT, "system") });
  });
});

describe("round trip", () => {
  const picks = everyPick();

  it("covers the system mode and the variants", () => {
    expect(picks).toContainEqual(pick("github", "system"));
    expect(picks).toContainEqual(pick("github", "system", "amoled"));
    expect(picks).toContainEqual(pick("nord", "dark", "amoled"));
    expect(picks.some((p) => p.theme === "nord" && p.mode === "system")).toBe(
      false,
    );
  });

  it.each(["ui", "terminal"] as Slot[])(
    "loses nothing in the %s slot",
    (slot) => {
      for (const p of picks) {
        const value = encodePick(p, slot, DEFAULT);
        expect(decodePick(value, slot, DEFAULT)).toEqual(p);
      }
    },
  );

  it("encodes the new values", () => {
    expect(encodePick(pick("github", "system"), "ui", DEFAULT)).toBe(
      "github_system",
    );
    expect(encodePick(pick("github", "system", "amoled"), "ui", DEFAULT)).toBe(
      "github_system_amoled",
    );
    expect(encodePick(pick(DEFAULT, "system"), "terminal", DEFAULT)).toBe(
      `${DEFAULT}_system`,
    );
  });

  it.each([
    pick("custom-ab12cd34", "dark"),
    pick("custom-ab12cd34", "system", "amoled"),
    pick("custom-z9", "light"),
  ])("carries custom id $theme", (p) => {
    for (const slot of ["ui", "terminal"] as Slot[]) {
      expect(decodePick(encodePick(p, slot, DEFAULT), slot, DEFAULT)).toEqual(
        p,
      );
    }
  });

  it("stays inside Storybook's URL charset", () => {
    for (const p of picks) {
      for (const slot of ["ui", "terminal"] as Slot[]) {
        expect(encodePick(p, slot, DEFAULT)).toMatch(/^[a-zA-Z0-9 _-]*$/);
      }
    }
    expect(encodePick(undefined, "terminal", DEFAULT)).toBe("follow");
  });
});

describe("urlGlobals", () => {
  it("reads the theme keys out of Storybook's globals parameter", () => {
    expect(
      urlGlobals(
        "?path=/story/x&globals=backgrounds.value:dark;theme:github_system_amoled;terminal:custom-ab12cd34_dark",
      ),
    ).toEqual({
      theme: "github_system_amoled",
      terminal: "custom-ab12cd34_dark",
    });
  });

  it("reads the encoded form an iframe URL carries", () => {
    expect(urlGlobals("?id=x&globals=theme%3Anord_dark")).toEqual({
      theme: "nord_dark",
    });
  });

  it("is empty without the parameter", () => {
    expect(urlGlobals("")).toEqual({});
    expect(urlGlobals("?globals=")).toEqual({});
  });
});

describe("garbage", () => {
  it.each(["", "x", "github_purple", "github_dark_", "_dark", 42, undefined])(
    "%j decodes to no pick",
    (value) => {
      expect(decodePick(value, "ui", DEFAULT)).toBeUndefined();
      expect(decodePick(value, "terminal", DEFAULT)).toBeUndefined();
    },
  );

  it("takes follow and system only in their own slot", () => {
    expect(decodePick("follow", "ui", DEFAULT)).toBeUndefined();
    expect(decodePick("system", "terminal", DEFAULT)).toBeUndefined();
  });
});

describe("changedGlobals", () => {
  const ui = pick("nord", "dark");
  const terminal = pick("github", "light");

  it("writes only the slot that changed", () => {
    expect(
      changedGlobals(
        { ui, terminal },
        { ui: pick("vs", "light"), terminal },
        {},
        DEFAULT,
      ),
    ).toEqual({ theme: "vs_light" });
    expect(changedGlobals({ ui }, { ui, terminal }, {}, DEFAULT)).toEqual({
      terminal: "github_light",
    });
    expect(changedGlobals({ ui, terminal }, { ui }, {}, DEFAULT)).toEqual({
      terminal: "follow",
    });
  });

  it("leaves a terminal pick normalization dropped alone on a UI commit", () => {
    // The URL holds terminal: custom-ab12cd34_dark, which this browser lacks,
    // so both normalized prefs have no terminal pick.
    const last = { theme: "nord_dark", terminal: "custom-ab12cd34_dark" };
    expect(
      changedGlobals({ ui }, { ui: pick("vs", "light") }, last, DEFAULT),
    ).toEqual({
      theme: "vs_light",
    });
  });

  it("writes nothing for an unchanged commit", () => {
    expect(
      changedGlobals({ ui, terminal }, { ui, terminal }, {}, DEFAULT),
    ).toEqual({});
  });

  it("drops a key already equal to last", () => {
    expect(
      changedGlobals(
        { ui, terminal },
        { ui: pick("vs", "light"), terminal: pick("vs", "dark") },
        { theme: "vs_light" },
        DEFAULT,
      ),
    ).toEqual({ terminal: "vs_dark" });
  });
});
