# @orz/ui-ansi

Text with ANSI escape sequences, such as CI logs, `ls --color` or `git diff --color`, drawn in the
active `@orz/ui` terminal colours. The package contributes a renderer to `@orz/ui-content`'s
registry, so an ```` ```ansi ```` fence in `@orz/ui-markdown` and an `.ansi` file in a viewer are
both drawn without importing this package from either. Its parser has no React and no DOM, and is
usable on its own.

## Install

```bash
pnpm add @orz/ui-ansi @orz/ui-content @orz/ui react lucide-react
```

There are no runtime dependencies. `@orz/ui-content` is a peer dependency so that the app and every
content package share one registry.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-ansi/styles.css";
```

Import it after `@orz/ui/styles.css`. It holds the selection colour (`--terminal-selection`), and
like `@orz/ui`'s stylesheet it registers `@source "./dist"` on its own.

## `ansiContent`

```tsx
import { ansiContent } from "@orz/ui-ansi";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";

const RENDERERS = [ansiContent, codeContent];

<ContentRenderers renderers={RENDERERS}>{app}</ContentRenderers>;
```

It accepts inline sources whose `lang` is `ansi` (any case), which is what a markdown fence becomes,
and files named `*.ansi` or typed `text/x-ansi`. It does not claim `.log` files or fences with other
tags. Register it before any renderer that takes every inline source, such as a code renderer, since
the first renderer that accepts wins.

- A fence draws the terminal pane, 32rem tall at most in a document.
- A file draws the file chrome, 32rem at most in a document and the attachment pane's height in a
  viewer. Its final newline is dropped, so it does not end on an empty numbered line. While it loads
  the registry's fallback link shows; a file that fails to load shows the message and a Retry button.
- A file declared or loaded over `ANSI_PREVIEW_MAX_BYTES` (64 MiB) is not drawn: it shows the
  download link and "Too large to preview — download to view."

## `AnsiView`

For a surface that draws ANSI text outside the registry:

```tsx
import { AnsiView } from "@orz/ui-ansi";

<AnsiView chrome="pane" text={output} />
<AnsiView chrome="file" text={log} filename="build.log" downloadUrl={url} maxHeight="40rem" />
```

| Prop | |
|---|---|
| `text` | The text, escapes included. |
| `chrome` | `"pane"`: the terminal pane, with Copy and Wrap on hover and on focus. `"file"`: a header with the filename, the line count, Wrap, Copy and Download, and a line-number gutter. |
| `filename` | Shown in the file header, and the region's accessible name. |
| `downloadUrl` | The header's Download link. |
| `boldIsBright` | Bold text in palette colours 0–7 is drawn in 8–15. Default `false`. |
| `wrap` | The initial wrap state; the Wrap button toggles it. Default `false`. |
| `maxHeight` | How tall the view may grow before it scrolls. Default: it grows to fit. |
| `className` | On the root. |

Copy writes the whole text with its escapes stripped, not only the rows on screen. A selection copied
from the view is rebuilt from the parsed lines, so a wrapped line copies as one line.

## `@orz/ui-ansi/parse`

```ts
import { createAnsiParser, parseAnsi, stripAnsi } from "@orz/ui-ansi/parse";

const { lines, styles, maxCells } = parseAnsi(text);
stripAnsi("\x1b[31merror\x1b[0m"); // "error"

const parser = createAnsiParser();
parser.push(chunk); // any split point: an escape cut in half is carried over
parser.end();
```

Each line holds its text, its display width in cells, and its runs as `[offset, styleId]` pairs over
one `Uint32Array`; styles are interned, so a million lines share a few dozen style objects.

What is drawn:

- SGR: bold, dim, italic, the underline styles (`4:1`–`4:5`, `21`), blink (kept, not animated),
  inverse, hidden, strike and overline; foreground, background and underline colour (`58`) as the 16
  palette colours, the 256-colour palette or 24-bit RGB, in both the `;` and `:` forms.
- `\r`, `\b`, `\t` (stops every 8 cells), `CSI C`/`D`/`G` and `CSI 0K`/`1K`/`2K` within the line, so
  a progress bar ends in its final state.
- OSC 8 links whose URI is `http:`, `https:` or `mailto:` and at most 2,048 characters.
- Wide characters take two cells and combining marks none, from `@orz/ui/lib/cell-width`.

What is dropped: every other CSI (cursor up and down, scroll regions, screen erase), every other OSC,
DCS, APC, PM and SOS up to its terminator, other C0 controls, and C1 controls. An unterminated OSC is
dropped once it passes 4 KiB, and the text after it is parsed normally.

## Theming

Palette colours 0–15 are `var(--ansi-*)`, and the default foreground and background are
`var(--terminal-foreground)` and `var(--terminal-background)`, which `@orz/themes` writes for every
theme, including the terminal slot. A theme change needs no re-render. The 256-colour palette and
24-bit colours are absolute, as in every terminal.

## Large text

Up to 1 MiB is parsed in one go; above that, the text is parsed in slices that yield to the browser,
and the header reads "Parsing… N lines" while it runs. Up to 5,000 visual rows every row is in the
DOM. Above that only the rows on screen are mounted, so find-in-page sees only those, and the view
needs a bounded height: without `maxHeight` it takes 32rem.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-ansi` | `ansiContent`, `ANSI_PREVIEW_MAX_BYTES`, `AnsiView`, `AnsiViewProps` |
| `@orz/ui-ansi/parse` | `parseAnsi`, `stripAnsi`, `createAnsiParser`, `xterm256`, `PALETTE_NAMES`, and the types |
| `@orz/ui-ansi/styles.css` | the selection colour |
