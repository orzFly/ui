---
name: orz-ui
description: Use when building or changing UI in an app that depends on @orz/ui or an @orz/ui-* package — picking a component, laying out a screen, navigation, forms, overlays, feedback, theming. Says how the components are meant to be used (as they are, never restyled) and where the guidelines are.
---

# Building with @orz/ui

`@orz/ui` is a React + Tailwind CSS v4 component library for tools people keep open all day: its
primitives, patterns, hooks and a theme store, with the heavier viewers (logs, code and diffs,
terminal recordings, markdown, diagrams, binaries, editors) in packages of their own. Every
component already carries the density, the touch sizes, the states and the user's theme; an app's
job is to pick the right one and leave it alone.

## Where to read

- The site: https://orzfly.github.io/ui/
- Every page as Markdown, indexed: https://orzfly.github.io/ui/llms.txt (all of them in one file: https://orzfly.github.io/ui/llms-full.txt)
- Start, the setup: https://orzfly.github.io/ui/start/index.md
- Storybook, every export with its props: https://orzfly.github.io/ui/storybook/

Read the Start page before writing any code: it sets up the CSS and the theme store, which this
skill does not repeat.

## Install

```bash
pnpm add @orz/ui @orz/query @orz/themes lucide-react radix-ui react react-dom sonner
# only for @orz/ui/fonts.css:
pnpm add @fontsource-variable/noto-sans @fontsource-variable/noto-sans-mono
# only for @orz/ui/hooks/use-overlay-scrollbars:
pnpm add overlayscrollbars
```

## Use the components as they are

This is the rule the rest follow from.

- Pick the component a guideline names for the job. Before using a component, read the guideline
  page that names it (llms.txt lists them all) and do what it says; its props are in Storybook.
- A `className` places a component: its position, its share of the space, the gap to its
  neighbours. It never restyles one: no colour, fill, border, radius, shadow, font size or weight
  of its own, and no look of its own for hover, the current place or a selection.
- Never draw a control the library has. A nav row is a `NavListLink`, an app's sections a
  `TabNav`, a confirmation a `ConfirmDialog`, a menu a `DropdownMenu`: a hand-made one draws its
  own states, and the app then reads differently from screen to screen.
- Never pass sizes for touch. Components grow to touch sizes under a coarse pointer by themselves.
- Never write a colour. Use the theme's tokens (`bg-background`, `text-muted-foreground`,
  `border`), so every theme the user picks still holds.
- Follow the guidelines' rules as written: undo over confirm, nothing only on hover, say what
  happened. When a page is silent, the Principles page decides.

## When there is no pattern for it

Compose what you need from library components under the same rule: layout classes only, no
colours, fills, borders or radii of your own. Then tell your user which pattern is missing, in one
sentence they can pass on ("@orz/ui has no pattern for a split button; composed one from Button
and DropdownMenu"), so it can be added to @orz/ui rather than drawn again in the next app.

## Packages

- `@orz/query`: The grammar of a search box and a slash-command line `pnpm add @orz/query`
- `@orz/themes`: Theme palettes for the UI and for terminals, as plain data `pnpm add @orz/themes`
- `@orz/ui`: React primitives, patterns, hooks and the theme store `pnpm add @orz/ui @orz/query @orz/themes lucide-react radix-ui react react-dom sonner`
- `@orz/ui-ansi`: Text with ANSI escapes, and logs by level `pnpm add @orz/ui-ansi @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react react-dom sonner`
- `@orz/ui-asciinema`: Terminal recordings played in the page `pnpm add @orz/ui-asciinema @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react react-dom sonner`
- `@orz/ui-code`: Highlighted code, diffs and a word differ `pnpm add @orz/ui-code @orz/query @orz/themes @orz/ui @orz/ui-content @pierre/diffs lucide-react radix-ui react react-dom sonner`
- `@orz/ui-codemirror`: CodeMirror 6 editors: prose, markdown, completion `pnpm add @orz/ui-codemirror @orz/query @orz/themes @orz/ui @codemirror/autocomplete @codemirror/commands @codemirror/language @codemirror/search @codemirror/state @codemirror/view @lezer/highlight lucide-react radix-ui react react-dom sonner`
- `@orz/ui-content`: The registry through which content packages draw one another `pnpm add @orz/ui-content react`
- `@orz/ui-hex`: A hex view, editor and data inspector `pnpm add @orz/ui-hex @orz/query @orz/themes @orz/ui lucide-react radix-ui react react-dom sonner`
- `@orz/ui-markdown`: GitHub-style markdown `pnpm add @orz/ui-markdown @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react react-dom sonner`
- `@orz/ui-mermaid`: Mermaid diagrams in the active theme `pnpm add @orz/ui-mermaid @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react react-dom sonner`
