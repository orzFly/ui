import {
  type CustomTheme,
  composeTheme,
  defaultTheme,
  type Palette,
  type TerminalTheme,
  type Theme,
} from "@orz/themes";
import { describe, expect, it } from "vitest";
import {
  type ImportEntry,
  parseThemeFile,
  serializeThemeFile,
  THEME_FILE_MAX_LENGTH,
  uniqueLabel,
} from "../src/lib/theme-file.ts";

const light = defaultTheme.light as Palette;
const dark = defaultTheme.dark as Palette;

/** Two palettes; the dark one carries the `amoled` variant. */
const harbor: Theme = { id: "harbor", label: "Harbor", light, dark };
/** Dark only. */
const ember: Theme = {
  id: "ember",
  label: "Ember",
  dark: {
    tokens: { ...dark.tokens, primary: "oklch(0.7 0.18 40)" },
    terminal: { ...dark.terminal, "terminal-background": "#1a0f0a" },
  },
};
/** Terminal-only, both schemes, a `deep` variant on the dark one. */
const tide: TerminalTheme = {
  id: "tide",
  label: "Tide",
  light: {
    terminal: { ...light.terminal, "terminal-background": "#f4f8fb" },
  },
  dark: {
    terminal: { ...dark.terminal, "terminal-background": "#0b1620" },
    variants: {
      deep: { label: "Deep", terminal: { "terminal-background": "#000000" } },
    },
  },
};
/** Only in the exporting app. */
const lagoon: Theme = {
  id: "lagoon",
  label: "Lagoon",
  light: {
    tokens: { ...light.tokens, primary: "oklch(0.55 0.15 220)" },
    terminal: { ...light.terminal, "ansi-blue": "#2266cc" },
  },
};
const reef: TerminalTheme = {
  id: "reef",
  label: "Reef",
  dark: { terminal: { ...dark.terminal, "ansi-red": "#ee4455" } },
};

const themes = [harbor, ember, tide];
const exporting = [...themes, lagoon, reef];

const dusk: CustomTheme = {
  id: "custom-dusk",
  label: "Dusk",
  light: {
    base: { theme: "harbor" },
    tokens: { primary: "oklch(0.6 0.2 30)" },
  },
  dark: {
    base: { theme: "harbor", variant: "amoled" },
    tokens: { ring: "#ff8800" },
  },
};
const paper: CustomTheme = {
  id: "custom-paper",
  label: "Paper",
  light: {
    tokens: { ...light.tokens, background: "#fbf8f1" },
    terminal: { tokens: { ...light.terminal, "ansi-red": "#aa2211" } },
  },
};
const tidal: CustomTheme = {
  id: "custom-tidal",
  label: "Tidal",
  light: {
    base: { theme: "harbor" },
    terminal: {
      base: { theme: "tide", scheme: "dark", variant: "deep" },
      tokens: { "ansi-red": "#ff3344" },
    },
  },
  dark: {
    tokens: { ...dark.tokens },
    terminal: { base: { theme: "tide" } },
  },
};
const embers: CustomTheme = {
  id: "custom-embers",
  label: "Embers",
  dark: { base: { theme: "ember" } },
};

function withoutId({ id: _, ...rest }: CustomTheme): Omit<CustomTheme, "id"> {
  return rest;
}

function file(...entries: unknown[]): string {
  return JSON.stringify({ format: "orz-themes", version: 1, themes: entries });
}

function entries(text: string, existing: string[] = []): ImportEntry[] {
  const result = parseThemeFile(text, themes, existing);
  if (!result.ok) throw new Error(result.error);
  return result.entries;
}

function only(text: string, existing: string[] = []): ImportEntry {
  const [entry, ...rest] = entries(text, existing);
  expect(rest).toEqual([]);
  return entry as ImportEntry;
}

/** The theme as exported from an app that has `lagoon` and `reef`. */
function exported(custom: CustomTheme): unknown {
  return JSON.parse(serializeThemeFile([custom], exporting)).themes[0];
}

describe("serializeThemeFile", () => {
  it("writes pretty JSON with a trailing newline and no ids", () => {
    const text = serializeThemeFile([dusk], themes);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('\n  "format": "orz-themes",\n');
    const parsed = JSON.parse(text);
    expect(parsed.version).toBe(1);
    expect(parsed.themes[0].label).toBe("Dusk");
    expect(text).not.toContain("custom-dusk");
  });

  it("snapshots every based side as the store composes it", () => {
    const [written] = JSON.parse(serializeThemeFile([dusk], themes)).themes;
    const composed = composeTheme(dusk, themes) as Theme;
    expect(written.light.resolved).toEqual({
      tokens: composed.light?.tokens,
      terminal: composed.light?.terminal,
    });
    expect(written.dark.resolved).toEqual({
      tokens: composed.dark?.tokens,
      terminal: composed.dark?.terminal,
    });
    expect(written.dark.resolved.tokens.ring).toBe("#ff8800");
  });

  it("snapshots based terminals with their overrides", () => {
    const [written] = JSON.parse(serializeThemeFile([tidal], themes)).themes;
    expect(written.light.terminal.resolved).toEqual({
      ...dark.terminal,
      "terminal-background": "#000000",
      "ansi-red": "#ff3344",
    });
    expect(written.light.resolved.terminal).toEqual(
      written.light.terminal.resolved,
    );
    // The dark side reads tide at its own scheme.
    expect(written.dark.terminal.resolved["terminal-background"]).toBe(
      "#0b1620",
    );
    expect(written.dark.resolved).toBeUndefined();
  });

  it("leaves out snapshots for sides that do not resolve", () => {
    const lost: CustomTheme = {
      id: "custom-lost",
      label: "Lost",
      light: { base: { theme: "ember" } },
      dark: { base: { theme: "gone" } },
    };
    const [written] = JSON.parse(serializeThemeFile([lost], themes)).themes;
    expect(written).toEqual({
      label: "Lost",
      light: { base: { theme: "ember" } },
      dark: { base: { theme: "gone" } },
    });
  });
});

describe("round trip", () => {
  it.each([
    ["based with overrides", dusk],
    ["detached", paper],
    ["based terminal on a terminal-only theme, and a detached side", tidal],
    ["following terminal", embers],
  ])("%s", (_, custom) => {
    const [entry] = entries(serializeThemeFile([custom], themes));
    expect(entry).toEqual({
      sourceLabel: custom.label,
      status: "ok",
      theme: withoutId(custom),
      messages: [],
    });
  });

  it("keeps several themes in order and never stores `resolved`", () => {
    const text = serializeThemeFile([dusk, paper, tidal, embers], themes);
    expect(text).toContain('"resolved"');
    const result = entries(text);
    expect(result.map((e) => e.theme)).toEqual(
      [dusk, paper, tidal, embers].map(withoutId),
    );
    expect(JSON.stringify(result)).not.toContain("resolved");
  });
});

describe("whole-file errors", () => {
  it.each([
    ["not JSON", "{ nope", "This isn't a theme file: it is not valid JSON."],
    [
      "wrong format",
      JSON.stringify({ format: "other", version: 1, themes: [] }),
      "This isn't an orz-themes file.",
    ],
    ["not an object", "[1, 2]", "This isn't an orz-themes file."],
    [
      "newer version",
      JSON.stringify({ format: "orz-themes", version: 2, themes: [] }),
      "This file was written by a newer version and can't be read here.",
    ],
    [
      "version that is not a number",
      JSON.stringify({ format: "orz-themes", version: "1", themes: [] }),
      "This isn't an orz-themes file.",
    ],
    [
      "too long",
      " ".repeat(THEME_FILE_MAX_LENGTH + 1),
      "This file is too large to be a theme file.",
    ],
    ["no themes", file(), "This file contains no themes."],
    [
      "themes missing",
      JSON.stringify({ format: "orz-themes", version: 1 }),
      "This file contains no themes.",
    ],
  ])("%s", (_, text, error) => {
    expect(parseThemeFile(text, themes, [])).toEqual({ ok: false, error });
  });

  it("accepts text exactly at the limit", () => {
    const text = file({ label: "Embers", dark: { base: { theme: "ember" } } });
    const padded = text + " ".repeat(THEME_FILE_MAX_LENGTH - text.length);
    expect(parseThemeFile(padded, themes, []).ok).toBe(true);
  });
});

describe("references", () => {
  it("keeps a reference whose base exists, dropping the snapshot", () => {
    const entry = only(file(exported(dusk)));
    expect(entry.status).toBe("ok");
    expect(entry.theme).toEqual(withoutId(dusk));
  });

  it("detaches a side whose base is missing, from its snapshot", () => {
    const custom: CustomTheme = {
      id: "custom-shore",
      label: "Shore",
      light: { base: { theme: "lagoon" }, tokens: { ring: "#00aaff" } },
      dark: { base: { theme: "harbor" } },
    };
    const entry = only(file(exported(custom)));
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      "lagoon isn't available here; the light side is imported as Fully custom from the colours saved in the file.",
    ]);
    expect(entry.theme).toEqual({
      label: "Shore",
      light: {
        tokens: { ...lagoon.light?.tokens, ring: "#00aaff" },
        terminal: { tokens: lagoon.light?.terminal },
      },
      dark: { base: { theme: "harbor" } },
    });
  });

  it("detaches a side whose base lacks the scheme, naming the base by label", () => {
    const snapshot = {
      tokens: { ...light.tokens, primary: "#884422" },
      terminal: light.terminal,
    };
    const entry = only(
      file({
        label: "Cinder",
        light: { base: { theme: "ember" }, resolved: snapshot },
      }),
    );
    expect(entry.messages).toEqual([
      "Ember isn't available here; the light side is imported as Fully custom from the colours saved in the file.",
    ]);
    expect(entry.theme).toEqual({
      label: "Cinder",
      light: { tokens: snapshot.tokens, terminal: { tokens: light.terminal } },
    });
  });

  it("keeps a based terminal on a detached side when its base exists", () => {
    const custom: CustomTheme = {
      id: "custom-mixed",
      label: "Mixed",
      light: {
        base: { theme: "lagoon" },
        terminal: { base: { theme: "tide" } },
      },
    };
    const entry = only(file(exported(custom)));
    expect(entry.theme?.light).toEqual({
      tokens: lagoon.light?.tokens,
      terminal: { base: { theme: "tide" } },
    });
  });

  it("detaches a based terminal on its own while its side keeps the reference", () => {
    const custom: CustomTheme = {
      id: "custom-coral",
      label: "Coral",
      dark: {
        base: { theme: "harbor" },
        terminal: {
          base: { theme: "reef" },
          tokens: { "ansi-blue": "#3355ff" },
        },
      },
    };
    const entry = only(file(exported(custom)));
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      "reef isn't available here; the dark side's terminal is imported as Fully custom from the colours saved in the file.",
    ]);
    expect(entry.theme).toEqual({
      label: "Coral",
      dark: {
        base: { theme: "harbor" },
        terminal: {
          tokens: {
            ...reef.dark?.terminal,
            "ansi-blue": "#3355ff",
          },
        },
      },
    });
  });

  it("lets a terminal without a snapshot follow its kept side's base", () => {
    const entry = only(
      file({
        label: "Coral",
        dark: {
          base: { theme: "harbor" },
          terminal: { base: { theme: "reef" } },
        },
      }),
    );
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      "reef isn't available here and the file has no saved colours for the dark side's terminal; it follows the side's base instead.",
    ]);
    expect(entry.theme).toEqual({
      label: "Coral",
      dark: { base: { theme: "harbor" } },
    });
  });

  it("takes a detached side's terminal from the side's snapshot when the terminal has none", () => {
    const snapshot = { tokens: light.tokens, terminal: tide.light?.terminal };
    const entry = only(
      file({
        label: "Drift",
        light: {
          base: { theme: "lagoon" },
          terminal: { base: { theme: "reef" } },
          resolved: snapshot,
        },
      }),
    );
    expect(entry.messages).toEqual([
      "lagoon isn't available here; the light side is imported as Fully custom from the colours saved in the file.",
      "reef isn't available here; the light side's terminal is imported as Fully custom from the colours saved in the file.",
    ]);
    expect(entry.theme?.light).toEqual({
      tokens: light.tokens,
      terminal: { tokens: tide.light?.terminal },
    });
  });

  it("drops a detached side whose based terminal is missing with no saved colours", () => {
    const entry = only(
      file({
        label: "Drift",
        light: {
          tokens: light.tokens,
          terminal: { base: { theme: "reef" } },
        },
      }),
    );
    expect(entry).toEqual({
      sourceLabel: "Drift",
      status: "rejected",
      messages: [
        "reef isn't available here and the file has no saved colours for the light side's terminal.",
      ],
    });
  });

  it("rejects a side with a missing base and no usable snapshot", () => {
    const entry = only(
      file({
        label: "Ghost",
        light: { base: { theme: "gone" } },
        dark: {
          base: { theme: "gone" },
          resolved: {
            tokens: { ...dark.tokens, primary: "nope" },
            terminal: dark.terminal,
          },
        },
      }),
    );
    expect(entry).toEqual({
      sourceLabel: "Ghost",
      status: "rejected",
      messages: [
        "gone isn't available here and the file has no saved colours for the light side.",
        "gone isn't available here and the file has no saved colours for the dark side.",
      ],
    });
  });
});

describe("entry messages", () => {
  it("renames a clashing label", () => {
    const entry = only(
      file({ label: "Dusk", dark: { base: { theme: "harbor" } } }),
      ["dusk"],
    );
    expect(entry).toEqual({
      sourceLabel: "Dusk",
      status: "renamed",
      theme: { label: "Dusk (2)", dark: { base: { theme: "harbor" } } },
      messages: ['Renamed from "Dusk": a theme with that name already exists.'],
    });
  });

  it("de-duplicates within one file and against base labels", () => {
    const side = { dark: { base: { theme: "harbor" } } };
    const result = entries(
      file(
        { label: "Harbor", ...side },
        { label: "harbor", ...side },
        { label: "  Night  ", ...side },
        { label: "night", ...side },
      ),
      ["Harbor", "Ember"],
    );
    expect(result.map((e) => e.theme?.label)).toEqual([
      "Harbor (2)",
      "harbor (3)",
      "Night",
      "night (2)",
    ]);
    expect(result.map((e) => e.status)).toEqual([
      "renamed",
      "renamed",
      "ok",
      "renamed",
    ]);
  });

  it("falls back to Default for a variant the base does not define", () => {
    const entry = only(
      file({
        label: "Neon",
        light: { base: { theme: "harbor", variant: "amoled" } },
        dark: { base: { theme: "harbor", variant: "neon" } },
      }),
    );
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      'Harbor has no variant "amoled" here; the light side uses Default.',
      'Harbor has no variant "neon" here; the dark side uses Default.',
    ]);
    expect(entry.theme).toEqual({
      label: "Neon",
      light: { base: { theme: "harbor" } },
      dark: { base: { theme: "harbor" } },
    });
  });

  it("falls back to Default for a terminal variant the base does not define", () => {
    const entry = only(
      file({
        label: "Neon",
        light: {
          base: { theme: "harbor" },
          terminal: { base: { theme: "tide", variant: "deep" } },
        },
      }),
    );
    expect(entry.messages).toEqual([
      'Tide has no variant "deep" here; the light side uses Default.',
    ]);
    expect(entry.theme?.light).toEqual({
      base: { theme: "harbor" },
      terminal: { base: { theme: "tide" } },
    });
  });

  it("ignores unknown token names and lists them once per side", () => {
    const entry = only(
      file({
        label: "Glow",
        light: {
          base: { theme: "harbor" },
          tokens: { primary: "#123456", glow: "#ffffff" },
          terminal: {
            base: { theme: "tide" },
            tokens: { "ansi-orange": "#ff8800", "ansi-red": "#ee0000" },
          },
        },
      }),
    );
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      "Ignored unknown colours: glow, ansi-orange.",
    ]);
    expect(entry.theme?.light).toEqual({
      base: { theme: "harbor" },
      tokens: { primary: "#123456" },
      terminal: { base: { theme: "tide" }, tokens: { "ansi-red": "#ee0000" } },
    });
  });

  it("puts the rename first among an adjusted entry's messages", () => {
    const entry = only(
      file({
        label: "Dusk",
        dark: { base: { theme: "harbor" }, tokens: { glow: "#ffffff" } },
      }),
      ["Dusk"],
    );
    expect(entry.status).toBe("adjusted");
    expect(entry.messages).toEqual([
      'Renamed from "Dusk": a theme with that name already exists.',
      "Ignored unknown colours: glow.",
    ]);
  });

  it("rejects an entry with neither side", () => {
    expect(only(file({ label: "Empty" }))).toEqual({
      sourceLabel: "Empty",
      status: "rejected",
      messages: ["It has neither a light nor a dark side."],
    });
  });

  it("rejects a fully custom side missing colours", () => {
    const { primary: _, ring: __, ...tokens } = light.tokens;
    const { "ansi-cyan": ___, ...terminal } = light.terminal;
    const entry = only(
      file({
        label: "Holes",
        light: { tokens, terminal: { tokens: terminal } },
      }),
    );
    expect(entry).toEqual({
      sourceLabel: "Holes",
      status: "rejected",
      messages: [
        "Its light side is missing colours: primary, ring, ansi-cyan.",
      ],
    });
  });

  it("rejects a value that is not a colour", () => {
    const entry = only(
      file({
        label: "Bad",
        dark: {
          base: { theme: "harbor" },
          tokens: { primary: "not-a-colour" },
        },
      }),
    );
    expect(entry.status).toBe("rejected");
    expect(entry.messages).toEqual([
      '"not-a-colour" for primary isn\'t a colour.',
    ]);
  });

  it("rejects a terminal value that is not hex", () => {
    const entry = only(
      file({
        label: "Bad",
        dark: {
          base: { theme: "harbor" },
          terminal: {
            base: { theme: "tide" },
            tokens: { "ansi-red": "rgb(255 0 0)" },
          },
        },
      }),
    );
    expect(entry.status).toBe("rejected");
    expect(entry.messages).toEqual([
      '"rgb(255 0 0)" for ansi-red isn\'t a hex colour.',
    ]);
  });

  it("drops only the failing side when the other survives", () => {
    const entry = only(
      file({
        label: "Half",
        light: { base: { theme: "gone" } },
        dark: { base: { theme: "harbor" } },
      }),
    );
    expect(entry).toEqual({
      sourceLabel: "Half",
      status: "adjusted",
      theme: { label: "Half", dark: { base: { theme: "harbor" } } },
      messages: [
        "gone isn't available here and the file has no saved colours for the light side.",
      ],
    });
  });

  it.each([
    ["an entry that is not an object", "Dusk", ""],
    [
      "an empty label",
      { label: "  ", dark: { base: { theme: "harbor" } } },
      "  ",
    ],
    ["a label that is not a string", { label: 5, dark: {} }, ""],
    ["a side that is not an object", { label: "Odd", light: "harbor" }, "Odd"],
    [
      "a fully custom side without a terminal",
      { label: "Odd", light: { tokens: light.tokens } },
      "Odd",
    ],
    [
      "a base without a theme",
      { label: "Odd", light: { base: { variant: "amoled" } } },
      "Odd",
    ],
    [
      "a terminal with a bad scheme",
      {
        label: "Odd",
        light: {
          base: { theme: "harbor" },
          terminal: { base: { theme: "tide", scheme: "dim" } },
        },
      },
      "Odd",
    ],
  ])("rejects the shape of %s", (_, raw, sourceLabel) => {
    expect(only(file(raw))).toEqual({
      sourceLabel,
      status: "rejected",
      messages: ["It isn't a valid theme entry."],
    });
  });

  it("does not let a rejected entry take its label", () => {
    const result = entries(
      file(
        { label: "Dusk" },
        { label: "Dusk", dark: { base: { theme: "harbor" } } },
      ),
    );
    expect(result[1]?.status).toBe("ok");
    expect(result[1]?.theme?.label).toBe("Dusk");
  });
});

describe("uniqueLabel", () => {
  it("keeps a free label, trimmed", () => {
    expect(uniqueLabel("  Dusk ", ["Dawn"])).toBe("Dusk");
  });

  it("numbers a taken label from 2", () => {
    expect(uniqueLabel("Dusk", ["Dusk"])).toBe("Dusk (2)");
  });

  it("compares case-insensitively", () => {
    expect(uniqueLabel("dusk", [" DUSK "])).toBe("dusk (2)");
  });

  it("takes the lowest free number", () => {
    expect(uniqueLabel("Dusk", ["Dusk", "Dusk (2)", "dusk (4)"])).toBe(
      "Dusk (3)",
    );
  });
});
