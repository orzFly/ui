---
name: orz-ui
description: Use when building or changing UI in an app that depends on @orz/ui or an @orz/ui-* package. Says how the components are meant to be used (as they are, composed before tweaked) and where the guidelines are.
---

# Building with @orz/ui

Every component already carries its density, touch sizes, states and the user's theme. Pick the
right one and prefer it as it is.

<!-- generated:site by scripts/readme.ts: run `pnpm fmt` after changing package.json's homepage -->
- Guidelines, every page as Markdown: https://orzfly.github.io/ui/llms.txt
- Setup: https://orzfly.github.io/ui/start/index.md
- Props of every export: https://orzfly.github.io/ui/storybook/
<!-- /generated -->

## Install

<!-- generated:skill-source by scripts/readme.ts: run `pnpm fmt` after changing the skill's target -->
This skill may be older than the packages, so it holds no install line. When the project already
depends on @orz/ui, read `node_modules/@orz/ui/skills/orz-ui/SKILL.md` and the `docs/` beside it
first: they ship with the package and match the installed version. Otherwise take the current
install line from the Start page (**Install**, and the **Packages** table), or from
`npm view <package> peerDependencies dependencies`. Then follow Start for the CSS and theme store.
<!-- /generated -->

## Rules

- Use the component a guideline names for the job; read that page first and do what it says.
- A `className` places a component (position, size in its parent, gaps) first of all.
- Never hand-draw a control the library has (nav rows are `NavList`, a tree of places `Tree`,
  a tree of files `FileTree`, sections `TabNav`, menus `DropdownMenu`, confirmations
  `ConfirmDialog`, the count and actions over selected rows `SelectionBar`, a list ordered by hand
  `Reorder`, a row of commands `Toolbar`). A `Toolbar` or a `TabNav` moves what does not fit
  into its `⋯` in the order you give it: never hide a command or a section at a breakpoint by
  hand.
- Anything that goes somewhere (a folder, a section, an item, Back) is an `a[href]` to its URL,
  never a `button` that navigates in JS. Pass the router's link with `asChild`, or keep the `href`
  and take over only clicks `isPlainClick` from `@orz/ui/lib/link` passes, so middle-click,
  Ctrl/⌘/Shift-click and the context menu still work.
- Write nothing the screen already shows: no subtitle restating its heading, no grey line under
  every label. What a setting, option or section does, when its label does not say, goes behind
  an `InfoPopover` right after the label. Empty, failed and done messages, a field's error and a
  limit needed while typing stay on screen (Principles, **Shown, not told**; Writing,
  **Explanations**).
- Never pass sizes for touch, and never write a colour: use the theme's tokens.
- No component for what you need? Compose it from library components before drawing your own.
- A light tweak on top (a token colour, a size, a weight) is fine when it holds up in every style
  and theme; check it in each. Prefer leaving a component's hover/current/selected look to it:
  a style redraws it.

## Packages

<!-- generated:packages by scripts/readme.ts: run `pnpm fmt` after changing a package's description -->
- `@orz/query`: The grammar of a search box and a slash-command line
- `@orz/themes`: Theme palettes for the UI and for terminals, as plain data
- `@orz/ui`: React primitives, patterns, hooks and the theme store
- `@orz/ui-ansi`: Text with ANSI escapes, and logs by level
- `@orz/ui-asciinema`: Terminal recordings played in the page
- `@orz/ui-code`: Highlighted code, diffs and a word differ
- `@orz/ui-codemirror`: CodeMirror 6 editors: prose, markdown, completion
- `@orz/ui-content`: The registry through which content packages draw one another
- `@orz/ui-hex`: A hex view, editor and data inspector
- `@orz/ui-json`: A JSON tree viewer: JSON, JSONC, JSON5, YAML and TOML, comments shown
- `@orz/ui-mail`: Mail messages (.eml): headers, body and attachments
- `@orz/ui-markdown`: GitHub-style markdown
- `@orz/ui-mermaid`: Mermaid diagrams in the active theme
<!-- /generated -->
