import { describe, expect, it } from "vitest";
import { TERMINAL_TOKEN_NAMES, xtermTheme } from "../src/index.ts";
import { terminal } from "./fixtures.ts";

describe("xtermTheme", () => {
  it("maps all 20 tokens onto the ITheme names", () => {
    // A distinct value per token, so a swapped pair cannot pass.
    const values = Object.fromEntries(
      TERMINAL_TOKEN_NAMES.map((name, i) => [
        name,
        `#0000${i.toString(16).padStart(2, "0")}`,
      ]),
    );
    const theme = xtermTheme(terminal("#000000", values));
    expect(theme).toEqual({
      background: values["terminal-background"],
      foreground: values["terminal-foreground"],
      cursor: values["terminal-cursor"],
      cursorAccent: values["terminal-background"],
      selectionBackground: values["terminal-selection"],
      black: values["ansi-black"],
      red: values["ansi-red"],
      green: values["ansi-green"],
      yellow: values["ansi-yellow"],
      blue: values["ansi-blue"],
      magenta: values["ansi-magenta"],
      cyan: values["ansi-cyan"],
      white: values["ansi-white"],
      brightBlack: values["ansi-bright-black"],
      brightRed: values["ansi-bright-red"],
      brightGreen: values["ansi-bright-green"],
      brightYellow: values["ansi-bright-yellow"],
      brightBlue: values["ansi-bright-blue"],
      brightMagenta: values["ansi-bright-magenta"],
      brightCyan: values["ansi-bright-cyan"],
      brightWhite: values["ansi-bright-white"],
    });
    // Every token reaches some field.
    expect(new Set(Object.values(theme)).size).toBe(20);
  });
});
