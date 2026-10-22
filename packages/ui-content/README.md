# @orz/ui-content

A registry where content packages contribute renderers and from which any surface asks for content
to be drawn. It is what lets markdown, code, diagrams and an attachment viewer render one another
without importing one another: each of them peers on this package, and the app decides at runtime
which renderers exist.

## Install

```bash
pnpm add @orz/ui-content react
```

The root entry has no runtime dependencies and needs no CSS. Its fallbacks are a plain `<pre>` and
a plain link, styled by whatever typography surrounds them. Attachment viewing, under
`@orz/ui-content/attachment`, needs more; see [Attachments](#attachments).

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

## File kinds

```ts
import { isImageFile, isTextFile, isMarkdownFile, formatSize } from "@orz/ui-content";

isImageFile(f)  isTextFile(f)     isMarkdownFile(f)  isHtmlFile(f)
isPdfFile(f)    isArchiveFile(f)  isAudioFile(f)     isVideoFile(f)
isTextEmbed(f)  // a text file that is not also an image (.svg is both)
formatSize(bytes) // "512 B", "1.5 KB", "20 KB"
```

Each predicate takes `{ name, mime? }`, so a file `ContentSource` passes straight in. A declared
type outranks the filename: the extension only counts when `mime` is missing, empty or
`application/octet-stream`. A `.png` declared `text/plain` is text, and a `.ts` uploaded as
octet-stream is TypeScript, never an MPEG transport stream. `mime` is read without its parameters
or case, so `Text/HTML; charset=utf-8` is `text/html`.

Renderers use these in `accepts` rather than matching extensions of their own, so that every
package draws the same file as the same kind.

## Attachments

`@orz/ui-content/attachment` draws files: renderers for images, HTML, PDF, video and audio, a frame
for text files embedded in a document, one viewer dialog, and the links and lists that open it. It
peers on `@orz/ui`, `lucide-react` and `react-dom` as well:

```bash
pnpm add @orz/ui-content @orz/ui lucide-react react react-dom
```

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-content/styles.css"; /* after @orz/ui's; only when ./attachment is used */
```

The stylesheet registers the package's shipped JS with Tailwind, so the classes the attachment
components use are generated.

### Registering the renderers

```tsx
import { ContentRenderers } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  attachmentCard,
  audioContent,
  htmlContent,
  imageContent,
  pdfContent,
  videoContent,
} from "@orz/ui-content/attachment";

const RENDERERS = [
  attachmentCard(),
  imageContent(),
  htmlContent(),
  pdfContent(),
  videoContent(),
  audioContent(),
  mermaidContent,
  markdownContent(),
  codeContent,
];

<ContentRenderers renderers={RENDERERS}>
  <AttachmentViewerProvider viewHref={viewHref} group={group}>
    <App />
  </AttachmentViewerProvider>
</ContentRenderers>;
```

The order matters, because the first renderer that accepts a source draws it:

- **`attachmentCard` first**, so a text file embedded in a document is framed before anything draws
  it. It hands the file on through `Next`, and the renderers after it draw the frame's body.
- **Images before text**, because an `.svg` is both, and it should be drawn as an image.
- **Markdown and diagrams before a renderer that takes every text file**, or that renderer would
  draw them as source.

| Renderer | Accepts | Placement | Draws |
|---|---|---|---|
| `attachmentCard({ maxBytes?, maxDepth?, collapsedClassName? })` | text files that are not images | `document` | `DocumentCard` around `Next` |
| `imageContent()` | images with a `url` | both | `<img>`; in a document, a click opens the viewer |
| `htmlContent({ src? })` | HTML with a `url` | `viewer` | `<iframe sandbox="allow-scripts">` |
| `pdfContent({ src? })` | PDF with a `url` | `viewer` | `<iframe>`, unsandboxed |
| `videoContent()` | video with a `url` | both | `<video controls preload="metadata">` |
| `audioContent()` | audio with a `url` | both | `<audio controls preload="metadata">` |

A file with no `url` is never accepted by the binary renderers, and falls through to the
registry's fallback. In a document an HTML file is text, so `attachmentCard` frames its source; a
PDF embed is the fallback's download link.

**Never add `allow-same-origin` to the HTML frame.** A file served from the app's own origin could
then run scripts that call the app's API with the reader's cookies. `allow-scripts` alone keeps the
document on an opaque origin. The PDF frame carries no sandbox because Chromium's PDF viewer refuses
to run in a sandboxed frame, so serve PDFs from a URL that cannot be mistaken for the app.

`attachmentCard`:

- past the depth limit (`maxDepth`, else the provider's `maxDepth`, else 1, counted as
  `markdownContent` counts it) it draws an `AttachmentLink` chip instead of a frame, so a document
  inside a card shows its own documents as links;
- over `maxBytes` (default `TEXT_PREVIEW_MAX_BYTES`, 1 MiB) it draws the frame with a note and no
  body. A file of unknown size is not capped; an app that cannot vouch for a size caps in its
  `load`;
- otherwise it draws the frame with the size, a download button and, inside a provider, an expand
  button that opens the viewer. Loading and load errors are drawn by the renderer `Next` reaches.

### The viewer

```ts
<AttachmentViewerProvider
  viewHref={(file) => string | undefined}   // where a browser tab shows the file
  group={(file) => ({ items, index }) | null} // the set paging covers when one file is opened
  textPreviewMaxBytes={1024 * 1024}          // text above this, or of unknown size, downloads
>

useAttachmentViewer(): { open(items, index), show(file) } | null  // null outside a provider
useCanPreview(file): boolean   // whether a plain click should open the viewer
useViewHref(file): string      // viewHref(file) ?? file.url ?? ""
```

One provider owns one dialog, and everything below it opens that one. A nested provider shadows
the outer one, so a surface can page through its own set.

- **`viewHref`** is for an app that serves a separate inline-view URL beside the download URL.
  Anchors, the HTML and PDF frames and "Open in new tab" use it; Download always uses `url`. When it
  returns undefined, "Open in new tab" is left out.
- **`group`** lets a click on one file page through the set it belongs to, positioned on it. A file
  it returns null for opens alone.
- **`useCanPreview`** is true when some registered renderer accepts the file in `"viewer"`
  placement and, for a text file, its size is known and within the cap. HTML is not capped: the
  browser streams it into the frame rather than this tab drawing it as text. `attachmentCard` draws
  its expand button only when this holds.

The dialog shows the name, ‹ n / m › for a set (← and → page, wrapping), and a maximize toggle that
fills the window and stays a modal. Its body is `<Content placement="viewer">`, or a download pane
for a file nothing can draw. The body sets `--attachment-pane-height` (`75vh`, or the remaining
height when maximized); a renderer in `"viewer"` placement sizes to it, as in
`max-h-(--attachment-pane-height)`. `AttachmentViewer` is the same dialog, controlled, for an app
that holds `{ items, index } | null` itself.

### Links, lists, cards and icons

- **`<AttachmentLink file boxed? className?>`** is an inline link wearing the file's type icon. It is
  a real anchor to `useViewHref(file)`, so copy-link and middle-click work; a plain left click on a
  file `useCanPreview` accepts opens the viewer. `boxed` draws it as a bordered chip. The chip's
  classes are exported as `RICH_CHIP_STRUCTURE`, `RICH_CHIP_SKIN`, `RICH_CHIP_ICON` and
  `RICH_CHIP_LABEL`.
- **`<AttachmentList items title? id? className?>`** lists files (`FileSource` plus a `key` and an
  optional ISO `createdAt`) with their icon, size, time and a download button. A list of eight or
  more keeps its newest five rows and folds the rest behind a toggle. A plain click on a row opens
  the viewer on the whole list. An empty list renders nothing.
- **`<DocumentCard name icon? meta? headerActions? downloadUrl? onExpand? collapsedClassName?>`** is
  the frame `attachmentCard` draws, for anything else that wants it: a header with the name, a
  muted note, extra actions, download and expand, around a height-capped body that offers "Show full
  document" when it overflows. Without `onExpand` it draws no expand controls.
- **`fileIcon(file)`** is the lucide icon for a file's kind: image, HTML, text, archive, audio,
  video, else a generic file.

`@orz/ui-markdown`'s `attachmentLinks` plugin draws markdown links to files as `AttachmentLink`s.
