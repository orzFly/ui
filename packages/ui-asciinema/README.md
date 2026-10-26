# @orz/ui-asciinema

[asciinema](https://asciinema.org/) recordings (`.cast` files) played in the page, in the colours
of `@orz/ui`'s terminal theme slot. The package contributes a renderer to `@orz/ui-content`'s
registry, so a `.cast` file in a viewer or an attachment plays without importing this package from
either. The engine is [asciinema-player](https://www.npmjs.com/package/asciinema-player) under a
`MediaControls`, the control bar from `@orz/ui`.

## Install

```bash
pnpm add @orz/ui-asciinema @orz/ui-content @orz/ui react lucide-react
```

`asciinema-player` is a regular dependency: installing this package is the whole setup.
`@orz/ui-content` is a peer dependency so that the app and every content package share one registry.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-asciinema/styles.css";
```

Import it after `@orz/ui/styles.css`. It brings asciinema-player's own stylesheet, imported into the
`components` layer, and the overrides that let the frame own the corners, the play overlay and the
fullscreen layout. Like `@orz/ui`'s stylesheet, it registers `@source "./dist"` on its own.

## `asciinemaContent`

```tsx
import { ContentRenderers } from "@orz/ui-content";
import { asciinemaContent } from "@orz/ui-asciinema";

const RENDERERS = [asciinemaContent, markdownContent(), codeContent];

<ContentRenderers renderers={RENDERERS}>{app}</ContentRenderers>;
```

It accepts files named `*.cast` (any case) or typed `application/x-asciicast`, in either placement,
and never an inline source: a fence stays code. Register it ahead of any renderer of your own that
would take a `.cast` as text, since the first renderer that accepts wins.

A recording plays under a strip holding its `title` (the file name when it has none) and a
Download link when the source has a `url`. While it loads, the registry's fallback shows; a load
that fails shows the message and a Retry button. A cast that does not scan — not JSON, an unknown
version, a malformed event line — goes on to `Next`, the renderers registered after this one, with
the reason in a muted line under it, so a broken file still offers its download.

`CAST_MAX_BYTES` is 16 MiB. A file whose declared `size` is over it is never loaded, and one that
turns out over it once loaded is not played: both show the fallback link and "Too large to preview
— download to view." The player parses a whole recording up front, which at the cap already takes
about a second.

## `AsciinemaPlayer`

For a surface that plays a recording outside the registry:

```tsx
import { AsciinemaPlayer } from "@orz/ui-asciinema";

<AsciinemaPlayer cast={text} />
<AsciinemaPlayer cast={text} header={<MyTitleStrip />} speed={2} className="max-w-3xl" />
```

| Prop | |
|---|---|
| `cast` | The recording's text: asciicast v1, v2 or v3. |
| `header` | Drawn above the terminal. |
| `speed` | Initial speed, default 1. The bar offers 0.5×, 1×, 1.5×, 2× and 4×. |
| `loop` | Restart at the end. Default false; the bar has no toggle for it. |
| `autoPlay` | Start playing once loaded. Default false. |
| `useEmbeddedTheme` | Use the palette a cast carries in its header instead of the terminal slot. Default false. |
| `className` | On the frame. |

A cast that does not scan shows the reason in place of the player. Until played, the terminal shows
the recording's final frame under a play button, and play starts from 0:00. The bar holds play and
pause, the time, a seek track with a tick per marker (hover for its label, click to jump),
speed, and fullscreen, which takes the whole frame, bar included. Focused on the terminal, the
player's own keys work: space, `,` and `.` to step, the arrows to seek, `0`–`9` to jump, `[` and
`]` between markers; `f` toggles the frame's fullscreen.

## Theme

The terminal's foreground, background and 16 ANSI colours come from the terminal slot
(`useTerminalTheme()`), converted to `#rrggbb` first, since the player reads nothing else: an oklch
custom theme plays in its own colours. The cursor and selection tokens have no counterpart in the
player. A palette embedded in a recording is ignored unless `useEmbeddedTheme` is set.

asciinema-player reads its palette, speed and fit only when it is created. A new terminal theme, a
new speed and entering or leaving fullscreen therefore build the player again, at the same position
and still playing if it was; the terminal can flash for a frame while it does.

## Loading

asciinema-player is only reached through `import("asciinema-player")`, from an effect, so a bundler
splits it (about 90 KB gzip, its VT engine compiled to WASM) into a chunk of its own, fetched the
first time a page holds a recording, and server rendering never touches it. Until it arrives, a
placeholder of the terminal's size holds the space and the bar shows the recording's length. An
import that fails shows the message and a Retry button that imports again.

## Licence

This package is BSD-3-Clause. asciinema-player, which it depends on and loads at run time, is
Apache-2.0.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-asciinema` | `asciinemaContent`, `CAST_MAX_BYTES`, `AsciinemaPlayer`, `scanCast`, `playerThemeVars` |
| `@orz/ui-asciinema/styles.css` | asciinema-player's stylesheet and the frame's overrides |
