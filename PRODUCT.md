# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, one behind the other.

- **The coding agents that build the maintainer's apps.** The apps are a family of tools: an issue
  tracker (todou, which most of this code was extracted from), a cloud desktop, a virtualization
  manager's web panel, an approval-workflow system, a reverse-proxy gateway, a
  code forge, a notes app, a personal assistant (calendar and to-dos), a metrics dashboard, and
  more to come. An agent picks components, reads the guidelines and the JSDoc, and follows them as
  written, so every rule has to be one an agent can act on without a person to interpret it.
  Outside developers installing from npm are welcome, and a later audience: the library is not
  shaped around them yet.
- **The people using those apps.** They keep the tool open all day and are in the middle of
  something else: triaging a list, reading a log or a diff, replaying a terminal session, editing a
  config. They use it at a desk with a mouse and keyboard, and on a phone with a thumb.

Every component decision is judged by the second audience; the docs, the guidelines, the API and
the install story are judged by the first.

## Product Purpose

A monorepo of React + Tailwind CSS v4 packages under the `@orz` npm scope: `@orz/ui` (primitives,
patterns, hooks and the theme store), `@orz/themes`, `@orz/query`, and viewers for what tools
produce — ANSI logs, code and diffs, terminal recordings, markdown, Mermaid diagrams, binaries,
CodeMirror editors. It exists so tools built on it do not each re-solve density, touch, theming and
tool-output rendering. Success is an app that reads as calm, dense with a pointer and generous with
a thumb, in whatever theme its user picked, without the app branching on any of it.

## Positioning

- **One component, two sizes, chosen by the pointer.** Hit areas grow on a coarse pointer by
  themselves; an app writes one layout.
- **The theme is the user's.** A theme store with built-in palettes (terminal palettes included)
  that every surface, viewer and diagram follows; nothing hard-codes a colour.
- **Viewers for tool output** as first-class, separately installable packages, so an app pays only
  for the heavy pieces it imports.
- **Docs held to the code.** Install lines, entry-point tables, theme lists, sizes and durations on
  the docs site are generated from the code or tested against it; nothing is restated by hand.

## Operating Context

- Written by AI: coding agents write the code under AGENTS.md, one tracker card at a time, and the
  maintainer dispatches, reviews and accepts. This is why what the code knows is generated or held
  to the code by a test rather than written by hand: an agent restating a fact gets it wrong
  quietly.
- Consumed as npm packages; workspace apps run on source through the `@orz/source` condition.
- The docs site (`apps/docs`, a prerendered Vite + React app on @orz/ui itself) carries the
  guidelines, live examples and full-screen demos; Storybook (`apps/storybook`) documents each
  export.
- Published from the public mirror `github.com/orzFly/ui`; the site is served at
  `https://orzfly.github.io/ui/`.

## Capabilities and Constraints

- Built on Radix (through shadcn primitives), sonner and lucide-react, all peer dependencies.
- Nothing app-specific: no API clients, no router or data-fetching library as a hard dependency, no
  app names in storage keys or labels. Where a component needs the app, it takes a callback or a
  prop.
- A dependency heavy enough to matter to a bundle (CodeMirror, unified, shiki, Mermaid) gets its own
  package.
- The repository is public and sanitized: no real hostnames, people or secrets in code, fixtures,
  docs or mockups (AGENTS.md, **Sanitization**).

## Brand Commitments

- Identity: "A UI library by AI, for AI." (the GitHub repository's description), alongside the
  docs home's "Components for tools people live in all day." Both hold; the site does not yet say
  the first.
- Names: `@orz/ui` and `@orz/ui-<name>`; the repository is `orzui`.
- Voice (`/guidelines/content/writing/`): plain, calm, exact; about the thing, not the app; never
  blaming; the same word for the same thing; sentence case everywhere.
- The six principles on `/guidelines/principles/` are binding: content first, chrome quiet; dense
  with a pointer, generous with a thumb; nothing only on hover; undo over confirm; the theme is the
  user's; say what happened.
- The guidelines defer to Apple's HIG, GNOME's HIG and WCAG 2.2 for numbers from outside the
  library.

## Evidence on Hand

- Guidelines and their live examples: `apps/docs/src/content/guidelines/`, `apps/docs/src/examples/`.
- Demos (Inbox, Tasks, Notes, Pull request, Config editor, Binary inspector, Settings):
  `apps/docs/src/demos/`, over fixtures in `apps/fixtures/src/`.
- Storybook stories: `apps/storybook/src/`.
- No testimonials, adoption numbers or outside users are on record; do not invent any.

## Product Principles

1. The user's work is the content; the library's chrome stays out of its way.
2. Components adapt to the input device by themselves, never by an app passing sizes.
3. No component breaks the theme the user chose.
4. Every state is distinguishable and says what happened.
5. A rule is written for an agent to follow as written; what the code knows is generated, not
   restated by hand.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor: text 4.5:1, edges and states 3:1, never colour alone, visible focus,
every action reachable by keyboard and by touch, single-key shortcuts that can be turned off, touch
target sizes, reduced motion respected. Third-party themes kept at their published values
(Catppuccin, the Pro themes) are the documented exception, listed on the accessibility page.
