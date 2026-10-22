import { describe, expect, it } from "vitest";
import {
  renderDeclarations,
  renderTerminalDeclarations,
  TERMINAL_TOKEN_NAMES,
  TOKEN_NAMES,
} from "../src/index.ts";
import { terminal, tokens } from "./fixtures.ts";

describe("renderDeclarations", () => {
  it("leads with color-scheme, then every UI token in TOKEN_NAMES order", () => {
    const text = renderDeclarations(
      tokens(0.5, { background: "oklch(0.1 0 0)" }),
      "dark",
    );
    const names = [...text.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
    expect(text.startsWith("color-scheme: dark; --diff-addition: ")).toBe(true);
    expect(names).toEqual(TOKEN_NAMES.map((n) => `--${n}`));
    expect(text).toContain("--background: oklch(0.1 0 0);");
    expect(text).not.toMatch(/[{}]|terminal|ansi/);
    expect(text.endsWith(";")).toBe(true);
  });
});

describe("renderTerminalDeclarations", () => {
  it("writes the 20 terminal tokens in TERMINAL_TOKEN_NAMES order", () => {
    const text = renderTerminalDeclarations(
      terminal("#123456", { "ansi-bright-white": "#ffffff" }),
    );
    const names = [...text.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
    expect(names).toEqual(TERMINAL_TOKEN_NAMES.map((n) => `--${n}`));
    expect(text.startsWith("--terminal-background: #123456;")).toBe(true);
    expect(text.endsWith("--ansi-bright-white: #ffffff;")).toBe(true);
  });
});
