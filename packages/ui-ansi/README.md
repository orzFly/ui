# @orz/ui-ansi

Text with ANSI escape sequences, such as CI logs, `ls --color` or `git diff --color`, drawn in the
active `@orz/ui` terminal colours, and plain logs, with each line coloured and filterable by its log
level. The package contributes two renderers to `@orz/ui-content`'s registry, so an
```` ```ansi ```` or ```` ```log ```` fence in `@orz/ui-markdown` and an `.ansi` or `.log` file in a
viewer are drawn without importing this package from either. Its parser and level detector have no
React and no DOM, and are usable on their own.

A log is the same view with levels turned on, not a second component: a `.log` file full of escapes
needs no routing decision, and plain text takes the parser's fast path at no extra cost.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-ansi @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react \
  react-dom sonner
```
<!-- /generated -->

There are no runtime dependencies. `@orz/ui-content` is a peer dependency so that the app and every
content package share one registry.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-ansi/styles.css";
```

Import it after `@orz/ui/styles.css`. It holds the selection colour (`--terminal-selection`), the level and
search-match colours, and
like `@orz/ui`'s stylesheet it registers `@source "./dist"` on its own.

## `ansiContent`

```tsx
import { ansiContent, logContent } from "@orz/ui-ansi";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";

const RENDERERS = [ansiContent, logContent, codeContent];

<ContentRenderers renderers={RENDERERS}>{app}</ContentRenderers>;
```

It accepts inline sources whose `lang` is `ansi` (any case), which is what a markdown fence becomes,
and files named `*.ansi` or typed `text/x-ansi`. `.log` files and `log` fences are `logContent`'s
(see [Logs](#logs)). Register it before any renderer that takes every inline source, such as a code renderer, since
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
<AnsiView chrome="file" text={log} filename="build.log" downloadUrl={url} maxHeight="40rem" levels />
```

| Prop | |
|---|---|
| `text` | The text, escapes included. |
| `chrome` | `"pane"`: the terminal pane, with Copy and Wrap on hover and on focus. `"file"`: a header with the filename, the line count, Wrap, Copy and Download, a toolbar with the level chips and the search box, and a line-number gutter. |
| `filename` | Shown in the file header, and the region's accessible name. |
| `downloadUrl` | The header's Download link. |
| `boldIsBright` | Bold text in palette colours 0–7 is drawn in 8–15. Default `false`. |
| `wrap` | The initial wrap state; the Wrap button toggles it. Default `false`. |
| `maxHeight` | How tall the view may grow before it scrolls. Default: it grows to fit. |
| `levels` | `true` colours each line by its detected level and, in file chrome, adds the level filter; a function replaces the detector (see [Logs](#logs)). Default `false`. |
| `className` | On the root. |

Copy writes the whole text with its escapes stripped, not only the rows on screen; while a filter
hides lines, it writes only the shown ones. A selection copied from the view is rebuilt from the
parsed lines, so a wrapped line copies as one line and a hidden line is never pasted.

## Logs

`logContent` accepts inline sources whose `lang` is `log` (any case), and files named `*.log` or
typed `text/x-log`. A file whose name and type disagree, such as `build.log` typed `text/x-ansi`,
goes to whichever of `logContent` and `ansiContent` is registered first. Both go before
`codeContent`: it claims the same sources, draws them with a syntax grammar, and stops at 1 MiB.
Files get everything `ansiContent`'s files get, including the 64 MiB cap. A fence draws the pane,
coloured by level but with no toolbar: fences are short, mount every row, and keep the browser's
find.

With `levels`, each line's level is read from its text, escapes stripped. A function in its place
replaces the detector for logs of a shape the rules below miss. Keep its identity across renders,
since a new function classifies the whole text again; a detector that throws is read as "no level"
for that line, and the first error is logged once.

```tsx
import type { LevelDetector } from "@orz/ui-ansi";

// At module level, so it keeps its identity.
const detect: LevelDetector = (text) => (text.startsWith("!!") ? { level: "error" } : null);

<AnsiView chrome="file" text={log} levels={detect} />;
```

`detectLevel` tries these rules over the first 256 characters, and the first that matches wins:

1. A JSON line with a `level`, `lvl`, `severity` or `loglevel` key, as a word or as a pino/bunyan
   number (≥60 fatal, ≥50 error, ≥40 warn, ≥30 info, ≥20 debug, below that trace).
2. logfmt: `level=`, `lvl=` or `severity=`.
3. A syslog priority, `<n>` at the start.
4. glog/klog: `E1023 09:14:11…`.
5. Android logcat, in the `brief` and `threadtime` forms.
6. `Traceback (most recent call last):`, as error.
7. A level word, whichever form comes first: UPPERCASE anywhere, any case inside `[…]`, `<…>` or
   `(…)`, any case before `:`, or any case as the line's first or second word.

| Words (any case) | Level |
|---|---|
| `fatal`, `critical`, `crit`, `emerg`, `emergency`, `alert`, `panic` | fatal |
| `error`, `err`, `severe` | error |
| `warning`, `warn` | warn |
| `info`, `information`, `notice` | info |
| `debug`, `dbg`, `fine` | debug |
| `trace`, `verbose`, `finer`, `finest` | trace |

A lowercase word in the middle of a message does not count, so "disk I/O error" and "no errors
expected" stay unlevelled, and the word must stand whole: `ERROR_CODE` and `errorCount` do not match.
The rules are a heuristic; the fixtures in `test/parse/levels.test.ts` are their specification.

A line with no level of its own takes the level of the line above when it looks like the rest of
that entry: it is indented, starts with `Caused by:`, `Suppressed:` or `... N more`, or is an
exception head such as `java.lang.IllegalStateException: …` or `ValueError: …`. A stack trace
therefore stays with its error under the filter, while an unindented `Done in 3.2s.` after a warning
does not. Any other line, a blank one included, is "Other" and ends the chain. This applies to a
custom detector too.

How a level shows, in the theme's terminal palette:

- Fatal, error and warn rows get a stripe on the left and a faint tint, so they stand out while
  scrolling; an inherited line's stripe is fainter.
- The level word takes the level's colour: bright red (inverted for fatal), red, yellow, green for
  info, blue for debug and grey for trace.
- Debug and trace text is dimmed.
- A line with ANSI colours of its own keeps them: no word colour and no dimming, but still the
  stripe, the tint and the filter.

In file chrome, a chip per level that occurs shows its line count. A click hides or shows that
level; shift+click shows only that level, and again shows all. Hidden lines leave the view: line
numbers keep their values, a dashed rule marks each gap, and the header reads "N of M lines".

## Search

The file chrome has a search box that finds text in every line, including the rows a virtualised
view has not mounted. Ctrl+F (⌘F) while focus is inside the view goes to it instead of the browser's
find; outside the view the browser's find is untouched. Enter and Shift+Enter, or the arrows, step
through the matches and wrap at the ends; Escape returns to the log and keeps the highlights.

- **Aa** matches case, **.\*** reads the query as a regular expression, and **≡** shows only the
  lines with a match.
- Search sees only the shown lines: a level the filter hides cannot be reached from the box.
- A match never spans two lines, and it is found in the text with escapes stripped.
- The scan runs in time slices, so typing stays responsive in a large log; the counter reads
  "3 / 41…" until it finishes. It stops storing at 100,000 matches and reads "100,000+".
- The slices bound the total time, not one `exec`: a pathological regular expression on one long line
  still blocks while it runs.

## `@orz/ui-ansi/parse`

```ts
import { createAnsiParser, parseAnsi, stripAnsi } from "@orz/ui-ansi/parse";

const { lines, styles, maxCells } = parseAnsi(text);
stripAnsi("\x1b[31merror\x1b[0m"); // "error"

const parser = createAnsiParser();
parser.push(chunk); // any split point: an escape cut in half is carried over
parser.end();
```

```ts
import { createLevelTracker, detectLevel } from "@orz/ui-ansi/parse";

detectLevel("2026-10-23 09:14:03 WARN pool exhausted"); // { level: "warn", from: 20, to: 24 }

const tracker = createLevelTracker(); // or createLevelTracker(detect)
tracker.push(lines, 0, lines.length); // then push(lines, tracker.count, lines.length) as lines arrive
tracker.levels; // one code per line, continuation lines included
tracker.counts; // { fatal, error, warn, info, debug, trace, other }
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
and the header reads "Parsing… N lines" while it runs; level counts grow with it. Up to 5,000
visual rows of the shown lines, every row is in the DOM. Above that only the rows on screen are
mounted, so the browser's find sees only those; in file chrome, the view's own search covers the
rest. A virtualised view needs a bounded height: without `maxHeight` it takes 32rem.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-ansi` | `ansiContent`, `logContent`, `ANSI_PREVIEW_MAX_BYTES`, `AnsiView`, `AnsiViewProps`, `LogLevel`, `LevelMatch`, `LevelDetector` |
| `@orz/ui-ansi/parse` | `parseAnsi`, `stripAnsi`, `createAnsiParser`, `detectLevel`, `createLevelTracker`, `LEVELS`, `LEVEL_INHERITED`, `levelCode`, `levelOfCode`, `xterm256`, `PALETTE_NAMES`, and the types |
| `@orz/ui-ansi/styles.css` | the selection, level and match colours |
