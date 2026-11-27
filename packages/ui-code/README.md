# @orz/ui-code

Read-only code and diff blocks, syntax-highlighted by [pierre](https://www.npmjs.com/package/@pierre/diffs)
on shiki and themed by `@orz/ui`, plus a word differ that segments CJK as well as English. The
package contributes two renderers to `@orz/ui-content`'s registry: `codeContent` for code and
`patchContent` for unified diffs.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-code @orz/query @orz/themes @orz/ui @orz/ui-content @pierre/diffs lucide-react \
  radix-ui react react-dom sonner
```
<!-- /generated -->

`@orz/ui-content` is a peer dependency so that the app and every content package share one registry.

`@pierre/diffs` is a peer dependency. pierre's highlighter is a module singleton, and its engine is
fixed by whichever surface creates it first. An app that renders pierre surfaces of its own has to
share that one copy with these blocks: a second copy would bring its own singleton, its own shiki
and its own wasm, and two highlighters that disagree about the engine.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-code/styles.css";
```

Import it after `@orz/ui/styles.css`. It pins every `diffs-container` to the app theme's
`color-scheme` and paints pierre's background and foreground from `--background` and
`--foreground`, so a block matches the page under every theme, including themes with no syntax
counterpart. It also colours a patch's `+`/`−` counts from the theme's `--diff-addition` and
`--diff-deletion`. Like `@orz/ui`'s stylesheet, it registers `@source "./dist"` on its own.

## Theme

Blocks follow `@orz/ui`'s `ThemeProvider`. A palette's `syntax` (or its variant's) names the shiki
theme for its token colors, or is a theme object of its own, which is registered with pierre under
its `name` the first time it is picked; a palette without one uses that slot of pierre's own
light/dark pair. Under `system` each slot comes from its own palette, so Solarized highlights as
solarized-light by day and solarized-dark at night. A pinned mode or a one-palette theme fills both
slots from the side on screen. Outside a provider, blocks use pierre's pair.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-code` | `CodeBlock`, `CodeDiffBlock`, `CodeWorkerProvider`, `useCodeWorkerFactory`, `fenceFilename`, `codeContent`, `patchContent`, `PatchView`, `FenceFrame`, `useInFenceFrame`, `FENCE_COLLAPSE_LINES`, `useSyntaxTheme`, `PIERRE_THEME`, `PIERRE_THEME_TYPE`, `PIERRE_HIGHLIGHTER`, `LazyMultiFileDiff`, `type SyntaxTheme` |
| `@orz/ui-code/word-diff` | `wordDiff`, `coalescedWordDiff`, `wordBag`, `bagWith`, types |
| `@orz/ui-code/styles.css` | the `diffs-container` rules |

pierre is only reached through dynamic imports, so a bundler splits it and shiki into their own
chunks, fetched when the first block renders. Until the chunk lands a block draws its plain text
rather than suspending: on a page's first load React does not commit a retry of a boundary that
suspends again within 300 ms of its fallback, and would render the whole page again once the chunk
arrived. The plain text is laid out as pierre lays out the block (its font, line height, margins,
background and line numbers), so nothing moves when the highlighting arrives. A server draws the
same text, since pierre is never fetched there, so a prerendered block needs no stand-in of its own.

### `@orz/ui-code`

`CodeBlock` takes a filename and infers the language from its extension. `fenceFilename` turns a
markdown fence's language tag into such a filename, falling back to plain text for a tag pierre
does not know:

```tsx
import { CodeBlock, CodeDiffBlock, fenceFilename } from "@orz/ui-code";

<CodeBlock filename={fenceFilename(lang)} contents={code} />
<CodeBlock filename="main.ts" contents={file} lineNumbers />
<CodeDiffBlock filename="main.ts" before={previous} after={current} />
```

`CodeBlock` takes `plain` to skip highlighting, and a `className` that caps a long file's height:
the code view virtualizes against its own box.

### Highlighting off the main thread

pierre tokenizes a whole file even when it draws a screenful: 1 MiB of log held the tab for 9.3 s
on the main thread, 0.2 s in pierre's worker. `CodeWorkerProvider` lends that worker to every
`CodeBlock` below it that sets `offThread`, which `codeContent` does for files and fences: the
first fence in a language compiles that grammar, 520 ms for TypeScript at 4x CPU throttling. The
lines show as
plain text at once and their colours follow. The worker script has to come from the app's bundler,
so the app starts it:

```tsx
import { CodeWorkerProvider } from "@orz/ui-code";
import PierreWorker from "@pierre/diffs/worker/worker.js?worker"; // Vite

<CodeWorkerProvider workerFactory={() => new PierreWorker()}>{app}</CodeWorkerProvider>
```

Without a provider those blocks tokenize on the main thread, as every other block does. The pool
is a page-wide singleton of two workers, created from the first factory and terminated when the
last block using it unmounts. `offThread` only pays off with a height cap in `className`:
uncapped, laying out every line of 1 MiB still held the main thread for 2.2 s.

`CodeDiffBlock` is a unified line diff of one block; with identical sides it renders a `CodeBlock`.

### `FenceFrame`

A code block's frame, which `codeContent`, `patchContent` and `@orz/ui-mermaid` put a fence in:

- **Copy** answers on the button, a check for a moment and "Copied" for a screen reader, and
  toasts only a failure (`writeClipboard` from `@orz/ui/lib/clipboard`).
- The block's `lang` and Copy sit in a toolbar that floats over the top-right corner where the
  pointer can hover (`can-hover:`), and shows on hover or once focus is inside. Without hover, or
  with `toolbarAlwaysVisible`, it takes a row of its own above the content instead, so it never
  covers a line for good.
- A `title` (a filename) draws `@orz/ui-content`'s `ContentHeader` in place of the toolbar, the
  header every named block in a document takes, whose name is an `a[href]` with `download` on a
  blob of the text. An `icon` draws the header too, with `lang` as its name.
- `collapsible` cuts the content at 20 lines (or half the screen), fading out above a **Show
  all** bar that draws the rest in place, as every long block in a document is cut
  (`ContentCollapse`). `true` cuts from the first frame and names `text`'s line count;
  `"measure"` cuts once the content proves taller than one and a half times the cut. Every line
  stays in the DOM, so find-in-page still reaches them, and expands the block.
- `onOpen` adds a ⤢ before Copy, and the bar of a cut block opens it there instead, as a patch
  opens in the attachment viewer.

The content is the children's alone. A code view inside reads `useInFenceFrame()` and leaves the
frame and Copy to it.

```tsx
import { CodeBlock, FenceFrame } from "@orz/ui-code";

<FenceFrame text={code} lang="yaml" title="compose.yaml" collapsible>
  <CodeBlock filename="compose.yaml" contents={code} copy={false} />
</FenceFrame>
```

### `codeContent`

The renderer this package contributes to `@orz/ui-content`'s registry. It
accepts every inline source, whatever its `lang`, and every file `isTextFile` calls text, in either
placement:

- An inline source, such as a markdown fence, is a `CodeBlock` named `fenceFilename(lang)`, in a
  `FenceFrame` (below) that carries its language or `title`, and cuts it past
  `FENCE_COLLAPSE_LINES` unless the source's `collapse` is false.
- A file is loaded through `useSourceText` and drawn as a `CodeBlock` under its own name, with
  line numbers and without its final newline, tokenized off the main thread when a
  `CodeWorkerProvider` is mounted. It is capped to the viewer's pane; in a card, to one screen
  while the card is cut, a long line still scrolling sideways, and to 70vh once the card shows it
  all, with Copy in the card's header. While it loads, it is the registry's fallback: a
  download link, or the bare name when there is no `url`. A failed load shows that fallback, the
  error and a Retry button.

It takes everything a narrower renderer would, so it goes after them in the list:

```tsx
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { markdownContent } from "@orz/ui-markdown";
import { mermaidContent } from "@orz/ui-mermaid";

const RENDERERS = [mermaidContent, markdownContent(), codeContent];

<ContentRenderers renderers={RENDERERS}>{app}</ContentRenderers>;
```

It highlights at most `TEXT_PREVIEW_MAX_BYTES` (1 MiB, from `@orz/ui-content`), so a path that
reaches it with a large file cannot freeze the tab:

- A file whose `size` is over `TEXT_PREVIEW_HARD_MAX_BYTES` (10 MiB) is not loaded: it draws the
  registry's fallback and "This file is too large to preview."
- Text over 1 MiB, declared or found once loaded, is drawn plain: still a virtualized code view
  with line numbers for a file, but with no highlighting, which is what costs. A file's plain view
  is capped as above. The viewer and `attachmentCard` ask before they draw a file that large.

### `patchContent`

Draws a unified diff as one diff per file, each commit's subject, author, date and hash in a row
above its message and files, with a file list (with `+`/`−` counts, jumping to a file) and a *raw*
toggle back to the text as written. It accepts a source tagged `diff` or `patch` (a fenced block)
and a file `isPatchFile` calls a patch, in either placement, so it goes before `codeContent`:

```tsx
const RENDERERS = [attachmentCard(), markdownContent(), patchContent, codeContent];
```

- `format-patch` mail, `show` / `log -p` output and a plain `diff -u` all read. The mail headers
  and the `--stat` are left to *raw*; a `diff` command line or an `Index:` banner above a plain diff
  names no commit.
- Parsing is strict: a hunk whose line counts do not add up, or text with no file in it, shows the
  text instead, rather than a patch with a change silently missing. A fence that is not a patch,
  such as a bare `+`/`-` snippet, stays highlighted text; a file that is not one says so above it.
- The file list and *raw* go into the title bar a surrounding surface lends (`useContentTitleBar`;
  `attachmentCard` lends its card's). With none, the patch draws a `FenceFrame` of its own, with
  Copy and the fence's `title` as a download, which is what a fence gets, so a fence inside a
  markdown card never takes over the card's bar.
- In a document a patch is cut as every long block is (`ContentCollapse`), once it proves taller
  than one and a half times the cut, and its **Show all** bar opens it in the attachment viewer;
  a fence's frame has a ⤢ that does the same. Where there is no viewer, or inside the viewer, the
  bar shows the rest in place. `collapsible={false}` (a fence whose `collapse` is false) keeps it
  whole, in a scroller of its own.
- The diffs are drawn in a height-capped box, which is what lets pierre virtualize them. While
  the patch is cut, or short, the box is one screen and does not scroll, and the file list does
  not jump, since nothing would scroll back; shown in place, it is a 70vh scroller, and in the
  viewer the 75vh pane less its bar (maximized too, for now). Outside a collapse, `fit` picks it.
- Each file's header row stays pinned to the top of the box while the file scrolls under it.
- With more than one file, a chevron at the start of each header folds that file down to its row
  and back. Jumping to a folded file from the file list unfolds it, and folding a file whose top has
  scrolled out of the box scrolls back to its header, so the next file follows it.
- A file diff over `LARGE_DIFF_LINES` (2,000) changed lines starts folded, with a *Load diff*
  button, unless it is the patch's only file: not for speed (a 40,000-line file drew in 0.1 s) but
  so a generated file does not bury the files around it.
- A file is loaded and capped as `codeContent` caps it, except that a patch up to 10 MiB is never
  asked about: its view is virtualized per file, and a 20 MiB one held the tab for 0.6 s at most.

`PatchView` is the same view on its own, for a surface outside the registry:

```tsx
<PatchView filename="fix.patch" text={text} lineNumbers invalidNote titleBar={bar} />
```

### `@orz/ui-code/word-diff`

Importing it pulls in neither React nor pierre.

```ts
import { coalescedWordDiff, wordDiff } from "@orz/ui-code/word-diff";

const { ins, del } = coalescedWordDiff(oldText, newText);
// ins: [start, end) ranges in newText
// del: { at, from, to }, a caret in newText and the deleted range in oldText
```

`wordDiff` is the bare word-level diff, for measuring how much changed. `coalescedWordDiff` folds
anchors lighter than the changes around them into those changes, which is what a reader should see
for a heavily rewritten line.

## Your own pierre surfaces

To render a pierre surface of your own that matches these blocks, build its options from the same
pieces. Naming the same `preferredHighlighter` is what keeps it on the shared singleton:

```tsx
import {
  LazyMultiFileDiff,
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  useSyntaxTheme,
} from "@orz/ui-code";

const theme = useSyntaxTheme();
const options = useMemo(
  () => ({
    theme,
    themeType: PIERRE_THEME_TYPE,
    preferredHighlighter: PIERRE_HIGHLIGHTER,
  }),
  [theme],
);

<LazyMultiFileDiff
  oldFile={oldFile}
  newFile={newFile}
  options={options}
  fallback={<p>Loading diff…</p>}
/>;
```

`LazyMultiFileDiff` draws `fallback` (nothing by default) while pierre's chunk loads instead of
suspending, like every surface in this package: a page whose first render suspended for the chunk
would be rendered again from scratch once it arrived.

## Failures

- While pierre's chunk loads and until it renders its first line, the block shows its text as a
  plain `<pre>`.
- When highlighting fails, the block falls back to the same plain text and logs one `console.warn`
  naming the file.
- A highlight that fails in the background leaves the plain text up, with no warning: pierre 1.6
  only logs those itself.
