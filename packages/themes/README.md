# @orz/themes

Theme palettes for `@orz/ui` and for terminals, as plain data, with the pure functions that resolve,
render and compose them. The package has no React, no DOM and no dependencies. `@orz/ui`'s theme
store paints these themes; anything else can read them too.

```bash
pnpm add @orz/themes
```

## Model

A theme has a palette per color scheme, and a palette can have variants:

```ts
const theme: Theme = {
  id: "solarized",
  label: "Solarized",
  light: { tokens: { … }, terminal: { … }, syntax: "solarized-light" },
  dark: {
    tokens: { … },
    terminal: { … },
    syntax: "solarized-dark",
    variants: { amoled: { label: "AMOLED", tokens: { background: "oklch(0 0 0)", … } } },
  },
};
```

- `light` and `dark` are the color scheme, the same axis as CSS `color-scheme`. A theme has at
  least one of them.
- Every palette carries two token groups. `tokens` are the UI custom properties `@orz/ui` paints
  with (`background`, `primary`, `sidebar-border`, …), as `oklch()` or hex. `terminal` holds a
  terminal's own background, foreground, cursor and selection and the 16 ANSI colours, as
  `#rrggbb` or `#rrggbbaa`, because terminal sources publish hex and xterm.js does not parse
  `oklch()`.
- `syntax` names the shiki theme from pierre's bundled collection that `@orz/ui-code` highlights
  with. Without it, code uses pierre's own colours.
- A variant is a partial override of one palette's tokens, and it is chosen for the whole theme.
  Picking AMOLED applies it to every palette that defines it, and a palette without it shows its
  default. An id means the same on both sides of a theme, so both palettes give it the same label.
- A **terminal-only theme** (`TerminalTheme`) has terminal tokens and no UI tokens. It can be
  picked for a terminal, and it can be used before a UI mapping for it exists. Every `Theme` is
  also a `TerminalTheme`, so a terminal can follow any UI theme.

Themes are plain JSON with no functions or classes, so a theme built by hand, imported or composed
can be stored, sent and compared like a built-in one.

## Themes

`builtinThemes` lists every built-in theme. Each one is also its own module, so an app that ships
three themes bundles three:

```ts
import { dracula } from "@orz/themes/themes/dracula";
import { github } from "@orz/themes/themes/github";
```

| Theme | Light | Dark |
|---|---|---|
| `defaultTheme` (`default`) | ✓ | ✓ |
| `picotera` | Pico | Tera |
| `solarized` | ✓ | ✓ |
| `vs` (Visual Studio) | ✓ | ✓ |
| `github` | ✓ | ✓ |
| `catppuccin` | Latte | Mocha |
| `gruvbox` | ✓ | ✓ |
| `dracula` | | ✓ |
| `nord` | | ✓ |
| `tokyoNight` (`tokyo-night`) | | ✓ |
| `oneDark` (`one-dark`) | | ✓ |
| `monokai` | | ✓ |

Every dark palette has an `amoled` variant.

To add a theme, write a module in `src/themes/` and add it to `builtinThemes` in `src/builtin.ts`
and to the exports in `src/index.ts`. The tests check every palette's tokens, its contrast, its
shiki name and its JSON round trip.

## Functions

- `resolvePalette(theme, scheme, variant?)` returns the palette with the variant applied, or null
  when the theme has no palette for that scheme. An unknown variant resolves to `default`.
  `resolveTerminal` does the same for terminal tokens and accepts terminal-only themes.
- `schemesOf(theme)`, `variantsOf(theme)` and `isUiTheme(theme)` describe a theme for a picker.
- `renderDeclarations(tokens, scheme)` and `renderTerminalDeclarations(terminal)` return the CSS
  declarations for a rule body (`color-scheme: dark; --background: …;`).
- `amoled(palette)` derives the AMOLED variant of a dark palette. Every surface token drops by the
  background's lightness, so the background becomes pure black while the surfaces keep their
  step from it and their hue. Text, primary, chart, diff and ring tokens, and values carrying
  alpha, stay as they are, and the terminal background becomes `#000000`. A theme opts in with
  `variants: { amoled: amoled(palette) }`, and can spread over the result to retune a token.
- `composeTheme(custom, themes)` turns a `CustomTheme` into a `Theme` against the current list.
  Each side either bases on a theme (`{ base: { theme, variant? }, tokens? }`) and overrides some
  tokens, or is detached (`{ tokens, terminal }`) and owns all of them. A side's terminal can base
  on any theme in the list, terminal-only ones included, with an optional `scheme`. A side whose
  base is missing is dropped, and the result is null when no side is left. Compose again whenever
  the list changes, so a custom theme follows its base.
- `xtermTheme(terminal)` maps terminal tokens onto xterm.js's `ITheme` field names:
  `terminal.options.theme = xtermTheme(tokens)`.

## Sources

The UI tokens were ported from `@orz/ui`'s earlier stylesheet. The terminal tokens come from each
theme's upstream terminal palette; `terminal-background` and `terminal-foreground` are the
palette's own background and foreground, so a terminal sits on the page's surface. Where upstream
sets no cursor, the cursor is the foreground (Monokai takes its editor cursor, `#f8f8f0`), and
where it sets no selection, the selection is VS Code's fallback.

| Theme | Terminal palette | Licence |
|---|---|---|
| Default, Visual Studio | [VS Code Light+ / Dark+ defaults](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts) | MIT |
| Picotera | derived from its own hues (see the module) | — |
| Solarized | [Solarized](https://github.com/altercation/solarized) | MIT |
| GitHub | [primer/github-vscode-theme](https://github.com/primer/github-vscode-theme) 6.3.5 | MIT |
| Catppuccin | [catppuccin/palette](https://github.com/catppuccin/palette) 1.8.0 | MIT |
| Gruvbox | [morhetz/gruvbox](https://github.com/morhetz/gruvbox), medium contrast | MIT/X11 per its README; the repository has no licence file |
| Dracula | [Dracula spec](https://github.com/dracula/spec) | MIT |
| Nord | [nordtheme/alacritty](https://github.com/nordtheme/alacritty) | MIT |
| Tokyo Night | [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) "night" | MIT header on the generated extras; the repository is Apache-2.0 |
| One Dark | [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) | MIT |
| Monokai | [VS Code's built-in Monokai](https://github.com/microsoft/vscode/tree/main/extensions/theme-monokai) | MIT |
