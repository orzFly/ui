# @orz/ui-code

Read-only code and diff blocks, syntax-highlighted by [pierre](https://www.npmjs.com/package/@pierre/diffs)
on shiki and themed by `@orz/ui`, plus a word differ that segments CJK as well as English.

## Install

```bash
pnpm add @orz/ui-code @orz/ui @pierre/diffs react react-dom
```

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
counterpart. Like `@orz/ui`'s stylesheet, it registers `@source "./dist"` on its own.

## Theme

Blocks follow `@orz/ui`'s `ThemeProvider`: a theme with a mapped syntax theme (`syntaxThemeOf`)
gets those token colors, and the rest use pierre's own light/dark pair. Outside a provider, blocks
use pierre's pair.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-code` | `CodeBlock`, `CodeDiffBlock`, `fenceFilename`, `useSyntaxTheme`, `PIERRE_THEME`, `PIERRE_THEME_TYPE`, `PIERRE_HIGHLIGHTER`, `LazyMultiFileDiff`, `type SyntaxTheme` |
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

`CodeDiffBlock` is a unified line diff of one block; with identical sides it renders a `CodeBlock`.

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
