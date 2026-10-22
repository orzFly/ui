import { catppuccin } from "./themes/catppuccin.ts";
import { defaultTheme } from "./themes/default.ts";
import { dracula } from "./themes/dracula.ts";
import { github } from "./themes/github.ts";
import { gruvbox } from "./themes/gruvbox.ts";
import { monokai } from "./themes/monokai.ts";
import { nord } from "./themes/nord.ts";
import { oneDark } from "./themes/one-dark.ts";
import { picotera } from "./themes/picotera.ts";
import { solarized } from "./themes/solarized.ts";
import { tokyoNight } from "./themes/tokyo-night.ts";
import { vs } from "./themes/vs.ts";
import type { Theme } from "./types.ts";

/** Every built-in theme, two-palette themes first. */
export const builtinThemes: readonly Theme[] = [
  defaultTheme,
  picotera,
  solarized,
  vs,
  github,
  catppuccin,
  gruvbox,
  dracula,
  nord,
  tokyoNight,
  oneDark,
  monokai,
];
