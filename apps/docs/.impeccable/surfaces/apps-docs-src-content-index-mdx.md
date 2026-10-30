---
version: 1
slug: "apps-docs-src-content-index-mdx"
primary_target: "apps/docs/src/content/index.mdx"
related_targets: []
---

# Docs home page

## Scope and mode

The docs site's home page, route `/` (`apps/docs/src/content/index.mdx`, `layout: "bare"`). Mode:
Persuade, inside the established module-mosaic world (DESIGN.md); this surface decides composition,
content and behaviour, not the visual system.

## Readers

- A person arriving from npm or GitHub deciding whether these are components for the kind of tool
  they build. Proof is the components at work on fixture data and the whole site restyling on a pick.
- A coding agent that needs the route through the docs, as a plain ordered list of links.

## Memorable moment

A pick in Your theme repaints the whole site at once, every module with it; under raymond the mosaic
becomes raymond's panels. No transition.

## Direction contract

- **THESIS.** The home page is a module mosaic: the page is tiled from the library's own modules,
  each one a real component at work under a marked header, so the page is its own proof. It refuses
  the category's default, a headline over subcopy and buttons with a row of equal cards below.
- **OWN-WORLD.** The default style as `DESIGN.md` records it: white ground, ink text, one ai accent;
  modules tiled edge to edge on shared 1px rules, square corners, each headed by a strip with the
  16px marker square; 13px body and 28px rows at a pointer. Only the hero headline steps outside the
  UI type scale. Under raymond the same modules become raymond's panels, because they are `Card`s.
- **STORY.** The visitor reads that these are components for tools people live in all day, sees a
  task list, a CI log, a diff and a terminal recording working on realistic data, picks a theme and
  watches every module (the terminal included) repaint, and copies the install line or follows Get
  started. An agent reads the "For agents" list and follows it in order.
- **FIRST VIEWPORT.** At 1440×900, below the site header, a 12-column mosaic: the hero module spans
  columns 1–6 over two rows (eyebrow, headline at display size, lede, the install line with Copy,
  Get started as the primary button and Browse components); Your theme (7–9) and For agents (10–12)
  share the first row on the right; Tasks spans 7–12 in the second row; the third row is CI log,
  diff and terminal recording, four columns each; the By AI / For AI / For people row starts at
  the fold. Get started is the one ai-filled button on the screen.
- **FORM.** The portal mosaic, third of seven on the ranked list; seed:0d39c5b7bc4700f6.
- **FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the
  verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

None. Critique reference: `c-portal.png` on UI-131 (code-led build, no approved comp).
