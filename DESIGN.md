---
name: "@orz/ui"
description: "The default style, the module mosaic: hairline-ruled modules tiled edge to edge on a white ground, dense ink text, one ai accent."
colors:
  ai: "#1f3d6b"
  ai-foreground: "#ffffff"
  ground: "#ffffff"
  ink: "#0f1727"
  strip: "#eff3f9"
  quiet-ink: "#4a5568"
  state-fill: "#e8eef7"
  sidebar-state-fill: "#dfe6f0"
  rule: "#bfc8d5"
  field-edge: "#7c8799"
  marker-tint: "#d3ddec"
  destructive: "#c8102e"
  success: "#12733a"
  warning: "#975a00"
typography:
  title:
    fontFamily: "Noto Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: "1.375rem"
  body:
    fontFamily: "Noto Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-sm:
    fontFamily: "Noto Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.125rem"
  module-title:
    fontFamily: "Noto Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: "1.125rem"
  label:
    fontFamily: "Noto Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
  data:
    fontFamily: "Noto Sans Mono Variable, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  control: "0.125rem"
  chip: "0.125rem"
  item: "0"
  frame: "0"
  surface: "0"
  overlay: "0"
spacing:
  control-xs: "1.5rem"
  control-sm: "1.5rem"
  control: "1.75rem"
  control-lg: "2rem"
  row: "1.75rem"
  row-head: "1.75rem"
  row-dense: "1.375rem"
  chip: "1.25rem"
  card: "0.75rem"
  card-sm: "0.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.ai-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "{spacing.control}"
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "{spacing.control}"
  button-outline-hover:
    backgroundColor: "{colors.strip}"
  button-ghost-hover:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
    height: "{spacing.control}"
  card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.card}"
  card-header:
    backgroundColor: "{colors.strip}"
    typography: "{typography.body-sm}"
    padding: "2px 8px"
    height: "{spacing.row}"
  module-marker:
    backgroundColor: "{colors.marker-tint}"
    textColor: "{colors.ai}"
    size: "16px"
  badge:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.ai-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
    height: "{spacing.chip}"
  tab:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.quiet-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.item}"
    padding: "0 12px"
    height: "{spacing.control}"
  tab-active:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  menu-item:
    typography: "{typography.body}"
    rounded: "{rounded.item}"
    padding: "4px 6px"
    height: "{spacing.row}"
  menu-item-highlighted:
    backgroundColor: "{colors.state-fill}"
    textColor: "{colors.ink}"
  table-head:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.ink}"
    padding: "0 8px"
    height: "{spacing.row-head}"
---

# Design System: @orz/ui

## Overview

**Creative North Star: "The Module Mosaic"**

The default style draws on contemporary Japanese high-density web pages: a bright white ground, dense ink text, and content held in hairline-ruled modules tiled edge to edge. Each module is headed by a ruled strip on the strip tint, opening with a 16px marker square. Nothing floats or rounds for decoration; structure comes from 1px rules, tints and type weight.

One strong colour, ai, carries meaning: where you are (the current tab, focus) and what you can do (the primary button, links, the marker's icon). Everything else is ink on white or neutrals pulled toward ai's hue (oklch h 258). State never rests on a fill alone: an ink bar or an ai edge says it in a second channel.

Density is for the pointer only. Under a coarse pointer, controls grow to 40px and 44px and field text to 16px, and those sizes outrank the style. Overlays fade in 100ms without moving, and reduced motion strips any travel a style adds.

**Key Characteristics:**
- White ground, ink text, one accent (ai), neutrals tinted to hue 258.
- Modules tiled edge to edge, sharing one 1px rule; square corners on every surface.
- Ruled header strip with a 16px marker square heading each module.
- 13px body text, 28px controls and rows with a pointer; 40/44px and 16px field text under touch.
- State cues in two channels: fill plus a 3px ink bar or a 2px ai top edge.

## Colors

A near-monochrome ink-on-white palette with a single deep indigo accent; dark mode keeps the roles in oklch at hue 258, and an AMOLED variant is derived from dark.

### Primary
- **Ai Indigo** (ai): the one strong colour. The primary button's fill, the focus ring, the current tab's top edge, link text and the marker's icon. Dark: `oklch(0.78 0.09 258)`, lightened to read on the dark ground.

### Neutral
- **Paper White** (ground): page, card and popover ground in light. Dark: `oklch(0.18 0.014 258)` for page and card, `oklch(0.21 0.016 258)` for popovers.
- **Dense Ink** (ink): all body text, and the colour of the 3px state bar. Dark: `oklch(0.94 0.012 258)`.
- **Strip Tint** (strip): module header strips, tab lists, table heads, footers, the sidebar, hover fills. Dark: `oklch(0.225 0.018 258)`.
- **Quiet Ink** (quiet-ink): secondary text and inactive tabs; held to 4.5:1 on ground and on strip.
- **State Fill** (state-fill): the highlighted or selected row's fill, always paired with the ink bar. Sidebar uses **Sidebar State Fill** (sidebar-state-fill).
- **Hairline Rule** (rule): every module edge, row divider and strip underline. Dark: `oklch(0.36 0.022 258)`.
- **Field Edge** (field-edge): input borders and outline buttons; held to 3:1 on ground, card and popover.
- **Marker Tint** (marker-tint): the marker square's fill, about 12% ai over strip. A palette that names none gets `markerOf()`'s mix, stepped down until the ai icon holds 4.5:1.

### Status
- **Destructive** (destructive), **Success** (success), **Warning** (warning): status text held to 4.5:1 on ground and popover. A destructive button or menu item draws its text as destructive mixed with 65% foreground over a 10% destructive tint.

### Named Rules
**The One Ink Accent Rule.** Ai marks only where you are and what you can do: the primary action, focus, the current tab, links, the marker icon. It never fills a module, a strip or a decoration.

**The Held Floors Rule.** Every built-in palette passes the contrast checks in `packages/themes/src/contrast.ts`: text pairs 4.5:1 (ai-foreground on ai, ai on ground, quiet ink on ground and strip, status on ground and popover, the marker icon on its square); field edges, focus rings, state cues and chart series 3:1.

## Typography

**Body Font:** Noto Sans Variable (with ui-sans-serif, system-ui, sans-serif)
**Mono Font:** Noto Sans Mono Variable (with ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)

**Character:** One humanist sans at small sizes, set dense; hierarchy comes from weight, not size. CJK text takes its own language's face (Noto Sans SC/TC/JP/KR, then the system's) by `:lang()`.

### Hierarchy
- **Title** (500, 15px, 22px): dialog and sheet titles, beside the marker square.
- **Body** (400, 13px, 20px): all control, menu, tab and running UI text.
- **Body small** (400, 12px, 18px): table text, header strips, descriptions, small buttons.
- **Module title** (700, 12px): the card title inside the ruled strip. Table heads use 600.
- **Label** (500, 11px, 16px): badges and counts; nothing smaller ships.
- **Data** (mono, 12px): dense tabular data such as the hex grid. Timestamps take tabular numerals.

### Named Rules
**The Eleven Pixel Floor Rule.** No UI text below 11px (`text-ui-xs`, `-2xs` and `-3xs` all resolve to 0.6875rem).

**The Sixteen Under Thumb Rule.** Text fields render at 16px under a coarse pointer and below `md`, and at 13px only with a fine pointer at `md` and up.

## Layout

Modules tile edge to edge: a card's edge is a 1px ring drawn outside the box, so two cards laid side by side paint one shared line. A card pads 12px (8px at `size="sm"`); its header strip pads 2px by 8px with a 28px minimum height and an 8px gap after the marker. Rows run 28px (menus, lists, table cells and heads), 22px for dense data; controls 24/28/32px; chips 20px.

Under a coarse pointer (`touch:`), controls rise to 40px (button, tab, input) and 44px (large button, menu items), and a smaller control gets a transparent 44px hit area that leaves its drawn size and the layout untouched. A `data-pointer` ancestor forces either branch.

## Elevation & Depth

Flat by construction. Surfaces tile on the ground with no shadow (`shadow-raised` is none); depth is a 1px rule, a strip tint or a ground change. Menus, popovers, dialogs and sheets lift by their 1px ring and one small hard shadow, offset without blur (`--shadow-menu` 2px 2px, `--shadow-overlay` 3px 3px, ink at 14%), so they read as above the mosaic rather than in it; modal overlays sit over a scrim of 10% black with a light backdrop blur.

### Named Rules
**The Tiled Not Stacked Rule.** A module separates from its neighbour by a shared hairline rule, never by a shadow or a gap with a drop.

## Shapes

Square. Surfaces, overlays, frames, rows and tabs carry 0 radius; controls and chips carry a 2px radius (`--radius` 0.125rem), and smaller parts cap the token rather than taking their own. Recurring geometry: the 16px marker square (icon 11px at stroke 2.4, or a 7 by 9 SVG play triangle when the module has no icon), the 3px leading bar, the 2px top edge.

## Components

### Buttons
- **Shape:** gently squared (2px), 28px high, 10px side padding, 13px medium text; 40px under touch (44px for large).
- **Primary:** ai fill, white text; hover drops the fill to 80%.
- **Outline:** field-edge border on ground; hover fills with strip.
- **Secondary / Ghost:** strip fill, or none until hover; ghost hovers to strip.
- **Destructive:** 10% destructive tint, text mixed 65% toward foreground.
- **Focus / Active:** 2px solid ai outline at 2px offset; press shifts down 1px.

### Chips
- **Style:** 20px high, 2px radius, 11px medium label, ai fill by default.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** ground; header strip and footer on strip, ruled off by 1px.
- **Shadow Strategy:** none on surfaces; one small hard offset shadow on what floats (see Elevation & Depth).
- **Border:** 1px rule as an outside ring, shared with tiled neighbours.
- **Internal Padding:** 12px, 8px small.

### Inputs / Fields
- **Style:** 1px field-edge border, transparent fill, 2px radius, 28px high (40px under touch).
- **Focus:** 2px solid ai outline at 2px offset.
- **Error / Disabled:** destructive border with a 3px 20% destructive ring; disabled at 50% opacity.

### Navigation
- **Tabs:** a strip-tinted list ruled underneath; tabs separated by 60% rules, 13px medium quiet ink. The current tab is a ground box that covers the list's rule to join its content, with a 2px ai edge across its top.
- **Menus and rows:** the highlighted or selected row takes the state fill and a 3px bar in its own text colour on its leading edge; table rows mark the first cell the same way.

### Module Marker
The 16px square that heads a card header, a viewer's toolbar, and a dialog or sheet title: marker tint, ai icon, or a play triangle when the module has none. The square keeps the triangle distinct from a row's disclosure chevron.

## Do's and Don'ts

### Do:
- **Do** head every module with the ruled strip and the 16px marker square.
- **Do** pair every state fill with a second cue: the 3px ink bar for rows, the 2px ai top edge for the current tab.
- **Do** keep touch sizes (40px, 44px hit areas) and 16px field text under a coarse pointer, whatever the style.
- **Do** read sizes and radii from the style tokens (`--spacing-control`, `--radius-surface`), capping a smaller part to the token rather than adding one.
- **Do** keep overlays at a 100ms fade with no travel; under reduced motion, translate, scale, rotate and blur reset.

### Don't:
- **Don't** use ai as a decorative fill or on anything that is not the current place or an action.
- **Don't** round a surface, overlay, row or tab.
- **Don't** set UI text below 11px.
- **Don't** mark selection, highlight or the current tab with a fill alone.
