# @orz/ui-code

Read-only code and diff blocks, syntax-highlighted by [pierre](https://www.npmjs.com/package/@pierre/diffs)
on shiki and themed by `@orz/ui`, plus a word differ that segments CJK as well as English. The
package contributes two renderers to `@orz/ui-content`'s registry: `codeContent` for code and
`patchContent` for unified diffs.

## Install

```bash
pnpm add @orz/ui-code @orz/ui @orz/ui-content @pierre/diffs lucide-react react react-dom
```

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
theme for its token colors, and a palette without one uses that slot of pierre's own light/dark
pair. Under `system` each slot comes from its own palette, so Solarized highlights as
solarized-light by day and solarized-dark at night. A pinned mode or a one-palette theme fills both
slots from the side on screen. Outside a provider, blocks use pierre's pair.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-code` | `CodeBlock`, `CodeDiffBlock`, `CodeWorkerProvider`, `useCodeWorkerFactory`, `fenceFilename`, `codeContent`, `patchContent`, `PatchView`, `useSyntaxTheme`, `PIERRE_THEME`, `PIERRE_THEME_TYPE`, `PIERRE_HIGHLIGHTER`, `LazyMultiFileDiff`, `type SyntaxTheme` |
| `@orz/ui-code/word-diff` | `wordDiff`, `coalescedWordDiff`, `wordBag`, `bagWith`, types |
| `@orz/ui-code/styles.css` | the `diffs-container` rules |

pierre is only reached through `lazy()`, so a bundler splits it and shiki into their own chunks,
fetched when the first block renders.

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
`CodeBlock` below it that sets `offThread`, which `codeContent` does for files. The lines show as
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

### `codeContent`

The renderer this package contributes to `@orz/ui-content`'s registry. It
accepts every inline source, whatever its `lang`, and every file `isTextFile` calls text, in either
placement:

- An inline source, such as a markdown fence, is a `CodeBlock` named `fenceFilename(lang)`.
- A file is loaded through `useSourceText` and drawn as a `CodeBlock` under its own name, with
  line numbers and without its final newline, tokenized off the main thread when a
  `CodeWorkerProvider` is mounted, and capped to the viewer's pane or a card's collapsed body. While it loads, it is the registry's fallback: a
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
  is capped at the viewer's pane height, or at a card's collapsed height in a document. The viewer
  and `attachmentCard` ask before they draw a file that large.

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
  `attachmentCard` lends its card's). With none, the patch draws a framed bar of its own, which is
  what a fence gets, so a fence inside a markdown card never takes over the card's bar.
- The diffs scroll inside a height-capped box, which is what lets pierre virtualize them: 70vh in a
  document, the viewer's 75vh pane less its bar (maximized too, for now). Inside a card, whose
  collapsed body hides its overflow, they do not scroll and the file list does not jump; the card
  expands instead. That assumes the card's `collapsedClassName` caps it below one screen: past it,
  the patch is cut at one screen.
- A file is loaded and capped as `codeContent` caps it.

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

<Suspense>
  <LazyMultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
</Suspense>;
```

## Failures

- While pierre's chunk loads and until it renders its first line, the block shows its text as a
  plain `<pre>`.
- When highlighting fails, the block falls back to the same plain text and logs one `console.warn`
  naming the file.
- A highlight that fails in the background leaves the plain text up, with no warning: pierre 1.6
  only logs those itself.
