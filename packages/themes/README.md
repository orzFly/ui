# @orz/themes

Theme palettes for `@orz/ui` and for terminals, as plain data, with the pure functions that resolve,
render and compose them. The package has no React, no DOM and no dependencies. `@orz/ui`'s theme
store paints these themes; anything else can read them too.

<!-- Generated from package.json by scripts/install.ts: run `pnpm fmt` after changing a peer. -->
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
- `syntax` is the shiki theme `@orz/ui-code` highlights with: the name of one in pierre's bundled
  collection, or a `TextMateTheme` object drawn for the palette, which `@orz/ui-code` registers
  under its `name`. `textMateTheme()` builds one from a page and a few role colours. Without
  `syntax`, code uses pierre's own colours.
- A variant is a partial override of one palette's tokens, and it is chosen for the whole theme.
  Picking AMOLED applies it to every palette that defines it, and a palette without it shows its
  default. An id means the same on both sides of a theme, so both palettes give it the same label.
  A picker lists `default` first, under the theme's `defaultVariantLabel` or "Default".
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
| `catppuccin` | Latte | Mocha, Frappé, Macchiato |
| `gruvbox` | ✓ | ✓ |
| `proGraphite`, `proNord`, `proSand`, `proMatcha` (`pro-graphite`, …) | ✓ | ✓ |
| `proSakura`, `proLavender`, `proLagoon`, `proCitrus` (`pro-sakura`, …) | ✓ | ✓ |
| `dracula` | | ✓ |
| `nord` | | ✓ |
| `tokyoNight` (`tokyo-night`) | | ✓ |
| `oneDark` (`one-dark`) | | ✓ |
| `monokai` | | ✓ |

Every dark palette has an `amoled` variant.

Catppuccin has one light flavour and three dark ones, so its light side is always Latte and its
variants pick the dark flavour: Mocha (the default), Frappé and Macchiato, then each again as Gray,
where every background and text colour is the neutral grey of the same OKLab lightness, Latte
included. It paints the published palette with no value adjusted, so a few of its pairs sit below
the contrast floors the tests hold every other theme to; `test/palettes.ts` lists them.

The eight Pro themes are the colour schemes of [Prohibitorum](https://github.com/TundraWork/Prohibitorum)'s
console, in its order: Graphite, Nord, Sand and Matcha, then Sakura, Lavender, Lagoon and Citrus.
They paint its colours as the browser resolves them, with no value adjusted, so ProCitrus's yellow
primary is a fill too light to read as text and ProGraphite keeps a light sidebar ring; the tests
list both. Prohibitorum draws a field's edge with its border, so `input` is the border mixed toward
the foreground until it clears 3:1. Prohibitorum has no code or terminal colours, so each Pro
theme carries its own syntax theme and ANSI colours, drawn for its page; ProMatcha, ProNord and
ProLavender, whose pages are Everforest's, Nord's and Catppuccin's, take that family's accents.
Every syntax colour clears 4.5:1 on the page, each normal ANSI colour 4.5:1 and each bright one
3:1. `src/prohibitorum.ts` holds the mapping and what it derives.

To add a theme, write a module in `src/themes/` and add it to `builtinThemes` in `src/builtin.ts`
and to the exports in `src/index.ts`. The tests check every palette's tokens, its contrast, its
syntax theme and its JSON round trip.

## Functions

- `resolvePalette(theme, scheme, variant?)` returns the palette with the variant applied, or null
  when the theme has no palette for that scheme. An unknown variant resolves to `default`.
  `resolveTerminal` does the same for terminal tokens and accepts terminal-only themes.
- `schemesOf(theme)`, `variantsOf(theme)` and `isUiTheme(theme)` describe a theme for a picker.
- `renderDeclarations(tokens, scheme)` and `renderTerminalDeclarations(terminal)` return the CSS
  declarations for a rule body (`color-scheme: dark; --background: …;`).
- `amoled(palette)` derives the AMOLED variant of a dark palette. The panels (`background`, `card`,
  `popover`, `sidebar`) drop by the background's lightness, so the background becomes pure black
  and the rest stay near it. Highlights, fills and opaque borders (`accent`, `muted`, `secondary`,
  `border`, …) keep their contrast with the background instead, so a hovered row or a menu
  highlight reads as clearly on black as on the dark palette. Every token keeps its hue and
  chroma. Text, primary, chart, diff and ring tokens, and values carrying
  alpha, stay as they are, and the terminal background becomes `#000000`. A theme opts in with
  `variants: { amoled: amoled(palette) }`, and can spread over the result to retune a token.
- `composeTheme(custom, themes)` turns a `CustomTheme` into a `Theme` against the current list.
  Each side either bases on a theme (`{ base: { theme, variant? }, tokens? }`) and overrides some
  tokens, or is detached (`{ tokens, terminal }`) and owns all of them. A side's terminal can base
  on any theme in the list, terminal-only ones included, with an optional `scheme`. A side whose
  base is missing is dropped, and the result is null when no side is left. Compose again whenever
  the list changes, so a custom theme follows its base.
- `composeTerminalTheme(custom, themes)` does the same for a `CustomTerminalTheme`
  (`kind: "terminal"`), a custom theme made of terminal colours alone. Each side is a
  `CustomTerminal`, resolved exactly as a UI side's terminal is, and the result is a
  `TerminalTheme` whose palettes carry `terminal` only. A `CustomTheme` has no `kind`, or
  `kind: "ui"`; `isCustomTerminalTheme(custom)` tells the two apart in an `AnyCustomTheme` list.
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
| Catppuccin | [catppuccin/palette](https://github.com/catppuccin/palette) 1.8.0, UI tokens too | MIT |
| Gruvbox | [morhetz/gruvbox](https://github.com/morhetz/gruvbox), medium contrast | MIT/X11 per its README; the repository has no licence file |
| Dracula | [Dracula spec](https://github.com/dracula/spec) | MIT |
| Nord | [nordtheme/alacritty](https://github.com/nordtheme/alacritty) | MIT |
| Tokyo Night | [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) "night" | MIT header on the generated extras; the repository is Apache-2.0 |
| One Dark | [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) | MIT |
| ProGraphite … ProCitrus | none upstream; Tailwind CSS 4.3.3's palette, UI tokens from [Prohibitorum](https://github.com/TundraWork/Prohibitorum) `6d3bc42` (see `src/prohibitorum.ts`); code and terminal colours drawn here, ProMatcha's, ProNord's and ProLavender's from [Everforest](https://github.com/sainnhe/everforest)'s, Nord's and Catppuccin's accents | Apache-2.0, see `NOTICE`; Tailwind CSS, Everforest, Nord and Catppuccin are MIT |
| Monokai | [VS Code's built-in Monokai](https://github.com/microsoft/vscode/tree/main/extensions/theme-monokai) | MIT |
