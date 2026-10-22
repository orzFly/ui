# @orz/ui-content

A registry where content packages contribute renderers and from which any surface asks for content
to be drawn. It is what lets markdown, code, diagrams and an attachment viewer render one another
without importing one another: each of them peers on this package, and the app decides at runtime
which renderers exist.

## Install

```bash
pnpm add @orz/ui-content react
```

It has no runtime dependencies and ships no CSS. Its fallbacks are a plain `<pre>` and a plain link,
styled by whatever typography surrounds them.

## The contract

```ts
type ContentSource =
  | { kind: "inline"; text: string; lang?: string }
  | {
      kind: "file";
      name: string;
      mime?: string;
      size?: number;
      url?: string; // where the bytes live: an <img>, an <iframe>, the download link
      load?: (signal: AbortSignal) => Promise<string>; // the text, for renderers that need it
    };

type Placement = "document" | "viewer"; // inside a flow of content, or owning the surface

type ContentRenderer = {
  name: string;
  accepts(source: ContentSource, placement: Placement): boolean;
  display?: "block" | "inline"; // default "block"
  Component: ComponentType<ContentProps & { Next: ComponentType<ContentProps> }>;
};
```

`accepts` must be synchronous and pure, decided from the descriptor alone. Callers make layout
decisions from it during render (a paragraph holding a block embed becomes a `<div>`), and those
must not flip when data arrives later.

## Registering and drawing

```tsx
import { Content, ContentRenderers, type ContentRenderer } from "@orz/ui-content";

const shout: ContentRenderer = {
  name: "shout",
  accepts: (source) => source.kind === "inline" && source.lang === "shout",
  Component: ({ source, className }) => (
    <strong className={className}>
      {source.kind === "inline" && source.text.toUpperCase()}
    </strong>
  ),
};

const framed: ContentRenderer = {
  name: "framed",
  accepts: (source) => source.kind === "file",
  Component: ({ Next, ...props }) => (
    <figure>
      <Next {...props} />
      <figcaption>{props.source.kind === "file" && props.source.name}</figcaption>
    </figure>
  ),
};

const renderers = [shout, framed];

<ContentRenderers renderers={renderers}>
  <Content source={{ kind: "inline", text: "hi", lang: "shout" }} placement="document" />
</ContentRenderers>;
```

- **Order.** The list is ordered and the first renderer that accepts a source draws it, so a narrow
  renderer goes before a broad one (markdown files before any text file). Renderers do not exclude
  one another's kinds; the app's order decides.
- **`Next`.** A renderer's `Next` draws the same source with the renderers after it, which is how a
  frame wraps whatever would have drawn the file anyway. Past the end of the list comes the
  fallback: `<pre><code>` for inline text, and a download link (or the bare name, when there is no
  `url`) for a file. `ContentFallback` is the same fallback as a component, for a renderer that
  decides to step aside.
- **Nesting.** A nested `<ContentRenderers>` puts its renderers in front of the outer ones, so a
  surface can override one kind locally.
- **Stable lists.** Keep `renderers` a module constant or a memo. Each position's `Next` is built
  once per list, so a renderer's subtree keeps its identity across re-renders. A new array rebuilds
  them, and React remounts whatever the renderers drew, collapsing any live text selection inside.
- **`className`** goes on the renderer's root element. A decoration pass that marked the element a
  source was written as (an embedded `<img>`) needs that class to survive the swap.

`useContentDisplay(source, placement)` answers `"block"`, `"inline"` or `null` (nothing registered
accepts it) without rendering anything. `useContentDisplayOf()` returns the same question as a
function, for a caller asking about several sources in one render.

## Depth

A file source drawn by a renderer raises `useContentDepth()` by one for everything below it, once
per `<Content>`. A document that embeds documents reads its depth to stop recursing: past its limit
it draws `ContentFallback`, a link, instead of the document. Inline sources never raise it, so a
code fence inside an embedded document still renders.

`<ContentRenderers maxDepth>` stores a limit for renderers to read with `useContentMaxDepth()`.
`<Content>` does not enforce it; each renderer that recurses decides what its limit means.

## Loading text

```tsx
import { ContentFallback, useSourceText, type ContentProps } from "@orz/ui-content";

function TextFile(props: ContentProps) {
  const text = useSourceText(props.source);
  if (text.status === "loading") return <ContentFallback {...props} />;
  if (text.status === "error") {
    return (
      <p>
        {text.error.message} <button onClick={text.retry}>Retry</button>
      </p>
    );
  }
  return <pre>{text.text}</pre>;
}
```

Inline text is ready at once. A file calls `load` when it has one and fetches `url` otherwise, and
the load is aborted on unmount and when the source changes; an aborted load is not reported as an
error. `retry()` runs the load again.

A file counts as changed when its `name` or `url` does, or, for a file with no `url`, when its `load`
function does. Keep such a `load` stable. A `load` beside a `url` is read from the latest render, so
a resolver building a fresh closure each render does not restart the load.

Size caps are the caller's: check `size` before asking for the text.
