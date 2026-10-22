import {
  catppuccin,
  dracula,
  github,
  type TerminalTheme,
  type Theme,
} from "@orz/themes";
import { describe, expect, it } from "vitest";
import {
  pickForTheme,
  pickForVariant,
  previewForVariant,
  schemesDefining,
} from "../src/theme/picks.ts";

/** GitHub with a dark-only "dimmed" and a light-only "soft" variant. */
const githubPlus = {
  ...github,
  id: "github-plus",
  light: {
    ...github.light,
    variants: { ...github.light?.variants, soft: { label: "Soft" } },
  },
  dark: {
    ...github.dark,
    variants: { ...github.dark?.variants, dimmed: { label: "Dimmed" } },
  },
} as Theme;

const system = { theme: "vs", mode: "system" } as const;
const light = { theme: "vs", mode: "light" } as const;
const dark = { theme: "vs", mode: "dark" } as const;

describe("schemesDefining", () => {
  it("finds default on every palette and a variant where it is defined", () => {
    expect(schemesDefining(githubPlus, "default")).toEqual(["light", "dark"]);
    expect(schemesDefining(githubPlus, "dimmed")).toEqual(["dark"]);
    expect(schemesDefining(githubPlus, "soft")).toEqual(["light"]);
    expect(schemesDefining(githubPlus, "constructor")).toEqual([]);
    expect(schemesDefining(dracula, "default")).toEqual(["dark"]);
  });
});

describe("pickForTheme", () => {
  it("keeps the mode as stored, with no variant", () => {
    expect(pickForTheme({ ...dark, variant: "amoled" }, catppuccin)).toEqual({
      theme: "catppuccin",
      mode: "dark",
    });
    expect(pickForTheme(system, dracula)).toEqual({
      theme: "dracula",
      mode: "system",
    });
  });

  it("takes the UI's mode for a first terminal pick, its current being the UI's", () => {
    const ui = { theme: "github", mode: "light" } as const;
    const terminalOnly: TerminalTheme = {
      id: "ink",
      label: "Ink",
      dark: { terminal: dracula.dark?.terminal as never },
    };
    expect(pickForTheme(ui, terminalOnly)).toEqual({
      theme: "ink",
      mode: "light",
    });
  });
});

describe("pickForVariant", () => {
  it("keeps system for a variant only one palette has", () => {
    expect(pickForVariant(system, githubPlus, "dimmed")).toEqual({
      theme: "github-plus",
      mode: "system",
      variant: "dimmed",
    });
  });

  it("moves a pinned mode to the palette that has the variant", () => {
    expect(pickForVariant(light, githubPlus, "dimmed")).toEqual({
      theme: "github-plus",
      mode: "dark",
      variant: "dimmed",
    });
    expect(pickForVariant(dark, githubPlus, "soft").mode).toBe("light");
    expect(pickForVariant(dark, githubPlus, "dimmed").mode).toBe("dark");
  });

  it("drops the variant field for default", () => {
    expect(pickForVariant(dark, githubPlus, "default")).toEqual({
      theme: "github-plus",
      mode: "dark",
    });
  });

  it("leaves a one-palette theme's mode for the store to fit", () => {
    expect(pickForVariant(system, dracula, "amoled")).toEqual({
      theme: "dracula",
      mode: "system",
      variant: "amoled",
    });
    expect(pickForVariant(light, dracula, "amoled").mode).toBe("dark");
  });
});

describe("previewForVariant", () => {
  it("pins AMOLED to dark under system by day, and not by night", () => {
    expect(previewForVariant(system, catppuccin, "amoled", "light")).toEqual({
      theme: "catppuccin",
      mode: "dark",
      variant: "amoled",
    });
    expect(previewForVariant(system, catppuccin, "amoled", "dark").mode).toBe(
      "system",
    );
  });

  it("follows the commit for a pinned mode", () => {
    expect(previewForVariant(light, githubPlus, "dimmed", "light")).toEqual(
      pickForVariant(light, githubPlus, "dimmed"),
    );
  });

  it("never pins default", () => {
    expect(previewForVariant(system, githubPlus, "default", "dark").mode).toBe(
      "system",
    );
  });
});
