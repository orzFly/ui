import { catppuccin } from "./themes/catppuccin.ts";
import { defaultTheme } from "./themes/default.ts";
import { dracula } from "./themes/dracula.ts";
import { github } from "./themes/github.ts";
import { gruvbox } from "./themes/gruvbox.ts";
import { monokai } from "./themes/monokai.ts";
import { nord } from "./themes/nord.ts";
import { oneDark } from "./themes/one-dark.ts";
import { picotera } from "./themes/picotera.ts";
import { proCitrus } from "./themes/pro-citrus.ts";
import { proGraphite } from "./themes/pro-graphite.ts";
import { proLagoon } from "./themes/pro-lagoon.ts";
import { proLavender } from "./themes/pro-lavender.ts";
import { proMatcha } from "./themes/pro-matcha.ts";
import { proNord } from "./themes/pro-nord.ts";
import { proSakura } from "./themes/pro-sakura.ts";
import { proSand } from "./themes/pro-sand.ts";
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
  proGraphite,
  proNord,
  proSand,
  proMatcha,
  proSakura,
  proLavender,
  proLagoon,
  proCitrus,
  dracula,
  nord,
  tokyoNight,
  oneDark,
  monokai,
];
