import { afterEach, describe, expect, it } from "vitest";
import { themePaintCookieStyle } from "../src/theme/index.ts";
import {
  ink,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
} from "./theme-helpers.ts";

resetThemeEnvironment();

function cookie(name: string): string | undefined {
  for (const part of document.cookie.split("; ")) {
    const at = part.indexOf("=");
    if (part.slice(0, at) === name) return part.slice(at + 1);
  }
  return undefined;
}

afterEach(() => {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    // biome-ignore lint/suspicious/noDocumentCookie: clears what the store wrote the same way
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
});

describe("paintCookie", () => {
  it("writes nothing without one", () => {
    stubDarkQuery(false);
    store().setPref({ ui: { theme: "nord", mode: "dark" } });
    expect(document.cookie).toBe("");
  });

  it("holds each side the committed pick can show", () => {
    stubDarkQuery(false);
    const themes = store({ paintCookie: "app-bg" });
    themes.setPref({ ui: { theme: "solarized", mode: "system" } });
    const value = JSON.parse(decodeURIComponent(cookie("app-bg") ?? ""));
    expect(Object.keys(value).sort()).toEqual(["dark", "light"]);
    themes.setPref({ ui: { theme: "dracula", mode: "dark" } });
    const dark = JSON.parse(decodeURIComponent(cookie("app-bg") ?? ""));
    expect(Object.keys(dark)).toEqual(["dark"]);
    expect(themePaintCookieStyle(cookie("app-bg"))).toBe(
      `html{background-color:${dark.dark};color-scheme:dark}`,
    );
  });

  it("is not written by a preview", () => {
    stubDarkQuery(false);
    const themes = store({ paintCookie: "app-bg" });
    themes.setPref({ ui: { theme: "github", mode: "light" } });
    const committed = cookie("app-bg");
    themes.preview({ ui: { theme: "dracula", mode: "dark" } });
    expect(cookie("app-bg")).toBe(committed);
  });

  it("writes nothing from a terminal-only store", () => {
    stubDarkQuery(false);
    store({
      paintCookie: "app-bg",
      themes: undefined,
      terminalThemes: [ink],
    }).setPref({ terminal: { theme: "ink", mode: "dark" } });
    expect(document.cookie).toBe("");
  });
});

describe("themePaintCookieStyle", () => {
  it("splits two sides by the OS", () => {
    const value = JSON.stringify({ light: "#ffffff", dark: "#000000" });
    expect(themePaintCookieStyle(value)).toBe(
      "html{background-color:#ffffff;color-scheme:light}" +
        "@media (prefers-color-scheme: dark){html{background-color:#000000;color-scheme:dark}}",
    );
  });

  it("reads the value decoded or not", () => {
    const value = JSON.stringify({ dark: "oklch(0.28 0.028 285)" });
    const css =
      "html{background-color:oklch(0.28 0.028 285);color-scheme:dark}";
    expect(themePaintCookieStyle(value)).toBe(css);
    expect(themePaintCookieStyle(encodeURIComponent(value))).toBe(css);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not JSON", "%E0%A4%A"],
    ["not an object", "42"],
    ["not a string", JSON.stringify({ dark: 1 })],
  ])("is empty for a %s value", (_, value) => {
    expect(themePaintCookieStyle(value)).toBe("");
  });

  it.each([
    "red;}body{display:none",
    "red</style><script>",
    'url("x")',
    "x".repeat(101),
    "rgb(0 0 0",
    "red) (",
  ])("drops a side that is not a plain colour: %s", (dark) => {
    const value = JSON.stringify({ light: "#fff", dark });
    expect(themePaintCookieStyle(value)).toBe(
      "html{background-color:#fff;color-scheme:light}",
    );
  });
});
