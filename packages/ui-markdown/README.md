# @orz/ui-markdown

GitHub-style markdown on [react-markdown](https://www.npmjs.com/package/react-markdown), extended by
markdown plugins. Code blocks and embedded files are drawn through
`@orz/ui-content`'s registry, so markdown reaches code, diagrams and other
documents without importing any of them.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-markdown @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui \
  react react-dom sonner
```
<!-- /generated -->

`@orz/ui-content` is a peer dependency so that the app, this package and every other content package
share one registry. `@orz/ui` provides the Retry button and the theme tokens the stylesheet paints
with.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-markdown/styles.css";
```

Import it after `@orz/ui/styles.css`. It holds the `.markdown-body` typography, in
`@layer components`, and no Tailwind directives: the package's own elements use no utility classes,
and the one exception, the Retry button, is `@orz/ui`'s `Button`, which `@orz/ui/styles.css`
already registers.

## `<Markdown>`

```tsx
import { Markdown } from "@orz/ui-markdown";

<Markdown>{source}</Markdown>
<Markdown plugins={plugins} className="text-sm" ref={rootRef}>{source}</Markdown>
<Markdown headingLevel={2}>{source}</Markdown>
```

The fixed chain is: GFM; links whose protocol react-markdown refuses, drawn as their source text;
YAML and TOML frontmatter as a two-column table; raw HTML escaped to its source except
`<details>`/`<summary>` folds. Plugins append to it and cannot remove any of it. A consumer who needs
a different chain composes react-markdown with the `lib/*` pieces below.

`headingLevel` is the level a `#` heading is drawn at, 1 by default; every deeper heading moves down
with it, stopping at `h6`, and the styles follow the tag drawn. A `<Markdown>` inside another, as an
embedded file is, starts a level below its host's `#`, so the page keeps one outline.

A `<pre>` holding one `<code>` is a code block. It renders inside
`<div class="markdown-fence">`, which carries the `<pre>`'s classes and, under `rehypeSourceLines`,
its `data-loc` stamp plus `data-loc-content-start`, the line the code starts on. Inside, the block is
`<Content source={{ kind: "inline", text, lang, title, collapse }} placement="document">`: whichever
renderer is registered draws it, and with none it is a plain `<pre><code>`. `title` is the filename
the info string names after the language, read by `fenceTitle`: ```` ```yaml compose.yaml ```` or
```` ```yaml title="compose.yaml" ````, while a first word holding `=` or opening on `{` names
none. `collapse` is the `collapseLongFences` prop, on by default; off, a renderer keeps every long
block whole, as a review that annotates lines needs. A document embedded in another follows its
host's. Registering `@orz/ui-code`'s `codeContent` highlights every fence, in a frame with Copy:

```tsx
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";

const RENDERERS = [codeContent];

<ContentRenderers renderers={RENDERERS}>
  <Markdown>{source}</Markdown>
</ContentRenderers>;
```

A renderer for one language, such as `@orz/ui-mermaid`'s `mermaidContent`, goes ahead of it in the
list.

**Keep `plugins` stable**: a module constant, or a `useMemo`. A fresh array, or a fresh plugin object
in it, makes react-markdown reparse the document and React remount every overridden element, and
either one collapses a live text selection inside it. With the same text, plugins and class,
`<Markdown>` does not render again at all: react-markdown keeps no parse cache.

## Writing a plugin

```ts
type MarkdownPlugin = {
  name: string;
  remarkPlugins?: PluggableList; // after the fixed syntax chain
  rehypePlugins?: PluggableList; // after rehypeDetails and rehypeHeadingLevels
  components?: { [Tag]?: ComponentType<ElementProps<Tag> & { Next }> }; // any tag but pre
  fence?: ComponentType<FenceProps & { Next: ComponentType<FenceProps> }>;
};
```

The first plugin in the list is outermost: its wrapper renders first, and its `Next` renders the
element the way the plugins after it would. The bottom of every element chain is the plain element;
the bottom of the fence chain is the registry. A heading reaches the wrapper for the level it is
drawn at, after `headingLevel` has moved it.

```tsx
import { rehypeSourceLines } from "@orz/ui-markdown/lib/rehype-source-lines";

const anchors: MarkdownPlugin = {
  name: "anchors",
  rehypePlugins: [rehypeSourceLines],
  components: {
    h2: ({ Next, ...props }) => (
      <a href={`#${slugOf(props.children)}`}>
        <Next {...props} />
      </a>
    ),
  },
  // FenceProps: { code, lang, meta, loc }; lang is the info string's first word as written,
  // meta the rest of it.
  fence: ({ Next, ...props }) =>
    props.lang === "todo" ? <TodoList text={props.code} /> : <Next {...props} />,
};

const PLUGINS = [anchors];
```

Element wrappers receive react-markdown's props, including the hast `node`; pass them on to `Next`.

## Embeds and markdown files

```tsx
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { Markdown, markdownContent, markdownEmbeds } from "@orz/ui-markdown";

const RENDERERS = [markdownContent(), codeContent];

function Doc({ source }: { source: string }) {
  const plugins = useMemo(() => [markdownEmbeds({ resolve })], []);
  return <Markdown plugins={plugins}>{source}</Markdown>;
}

<ContentRenderers renderers={RENDERERS}>
  <Doc source={"See the plan:\n\n![plan](files/plan.md)"} />
</ContentRenderers>;
```

- **`markdownEmbeds({ resolve })`.** `resolve(href)` turns an image address into a
  `ContentSource`, or null to leave the `<img>` alone. It must be synchronous and pure. An image
  whose source some registered renderer accepts is drawn by it, keeping the `<img>`'s class. A
  paragraph carrying a block embed becomes `div.markdown-paragraph`, decided from the markdown,
  `resolve` and the renderers' `accepts`, never from loaded data, so it cannot flip when the text
  arrives. An image inside a link is a plain `<img>` of the file it resolves to, so a click on it
  goes where the link does. Links are not touched.
- **`markdownContent({ plugins?, maxDepth? })`** accepts files named `*.md`/`*.markdown` or typed
  `text/markdown`, in either placement. It shows the fallback link while loading, the message and a
  Retry button on failure, and the document once loaded, with the plugins of the enclosing
  `<Markdown>` (else `options.plugins`) and its headings a level below that `<Markdown>`'s. In
  `"document"` placement, a document deeper than `maxDepth` (else the provider's `maxDepth`, else
  1) is a link: a document inside a document shows its own documents as links, which is what stops
  a document that embeds itself. A `"viewer"` placement is never limited. A "source" toggle in the
  title bar a surface lends (the viewer, `attachmentCard`) swaps the rendered document for its
  source, drawn by the renderers after this one (`codeContent`). A document over
  `MARKDOWN_RENDER_MAX_CHARS` (128K characters) opens as source, with "Too large to render
  automatically.", since rendering it would hold the tab for seconds; with no title bar lent, such
  a document gets the toggle above it.
- **`attachmentLinks({ resolve, boxed? })`** draws a link whose address `resolve` turns into a
  file as an `AttachmentLink` chip from `@orz/ui-content/attachment`, which opens the nearest
  `AttachmentViewerProvider`'s viewer on a plain click. Every other link goes on to the next
  plugin. `resolve` has `markdownEmbeds`' signature, so one function serves both:
  `[markdownEmbeds({ resolve }), attachmentLinks({ resolve })]`. A file `resolve` marks `deleted`
  is a `DeletedAttachmentMark` in either plugin, inline in its paragraph, rather than a link to
  nothing or a broken image. Using it means installing what
  `@orz/ui-content/attachment` needs (its README, "Attachments").
- **`imagePairs({ resolve? })`** draws a paragraph, or a list item's opening line, that is exactly
  two images with `→` or `->` between them as one `MediaCompare` from `@orz/ui-content/compare`.
  Each side is tagged by its alt, or Before and After where the alt is empty or only the file's
  name. `resolve` has `markdownEmbeds`' signature: a resolved file is drawn from its `url` and
  named by its `name`, and one marked `deleted` is a side that failed. The paragraph becomes
  `div.markdown-paragraph`, keeping its props. Within an `AttachmentViewerProvider`, a click on
  either picture opens the pair in the viewer through `useViewerCompare`, paging through every
  comparison below the provider in document order, other documents' and the app's own included.
  `markdownEmbeds` leaves a pair to it, in either order.
- **`externalLinks({ origin? })`** opens a link to an http(s) address on another origin (default
  `window.location.origin`) in a new tab, with `rel="noopener noreferrer"`; `styles.css` draws a ↗
  after it, except on an image link. Relative, same-origin, fragment and `mailto:` links are left
  alone. Put it after `attachmentLinks`, so file links are claimed first, and leave it out of the
  list to keep every link in this tab. `isExternalHref(href, origin?)` is the test it applies.

Register `markdownContent` ahead of any renderer that takes every text file, since the first renderer
that accepts wins. `react-markdown` refuses some URL schemes (`file:` among them), and an address it
refuses is drawn as source text before `resolve` sees it: use relative addresses or `https:`.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-markdown` | `Markdown`, `MarkdownPluginsContext`, `markdownEmbeds`, `attachmentLinks`, `externalLinks`, `isExternalHref`, `imagePairs`, `markdownContent`, `MARKDOWN_RENDER_MAX_CHARS`, `fenceTitle`, types (`MarkdownPlugin`, `FenceProps`, `ElementProps`, …) |
| `@orz/ui-markdown/lib/markdown-processor` | `MARKDOWN_SYNTAX_PLUGINS`, `parseMarkdown` |
| `@orz/ui-markdown/lib/remark-frontmatter-table` | `remarkFrontmatterTable`, `frontmatterFields`, `FRONTMATTER_FLAVOURS`, node types |
| `@orz/ui-markdown/lib/remark-rejected-urls` | `remarkRejectedUrlsAsText` |
| `@orz/ui-markdown/lib/rehype-source-lines` | `rehypeSourceLines`, `SOURCE_LINE_ATTR`, `CODE_CONTENT_START_ATTR`, `parseSourceLoc` |
| `@orz/ui-markdown/lib/rehype-details` | `rehypeDetails` |
| `@orz/ui-markdown/lib/rehype-heading-levels` | `rehypeHeadingLevels`, `RehypeHeadingLevelsOptions` |
| `@orz/ui-markdown/lib/rehype-image-pairs` | `rehypeImagePairs`, `imagePairOf`, `isPairImage`, `pairLabel`, `PAIR_ATTR`, `PAIR_BEFORE_SRC_ATTR`, `PAIR_BEFORE_ALT_ATTR`, `PAIR_BEFORE_AT_ATTR` |
| `@orz/ui-markdown/lib/fence-meta` | `fenceTitle` |
| `@orz/ui-markdown/styles.css` | the `.markdown-body` typography |

The unified pieces are exported one by one so that code rebuilding the same tree outside React (an
index over the source, a diff) runs exactly the renderer's chain.
