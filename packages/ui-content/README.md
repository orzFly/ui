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
      deleted?: boolean; // links and embeds draw it struck through, as deleted
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

## Title bar

A surface with a title bar of its own (a card, a dialog) can lend a spot in it to the renderer
drawing its file, for controls that belong next to the surface's own:

```tsx
import { ContentTitleBar, useContentTitleBar } from "@orz/ui-content";

// The surface: a spot in its bar, and the slot around its body.
const [bar, setBar] = useState<HTMLElement | null>(null);
<span ref={setBar} className="contents" />
<ContentTitleBar source={file} target={bar}>
  <Content source={file} placement="viewer" />
</ContentTitleBar>

// A renderer: portal the controls there, or draw a bar of its own.
const bar = useContentTitleBar(source);
if (bar === undefined) return <FramedWithOwnBar />;
return <>{bar !== null && createPortal(controls, bar)}{body}</>;
```

`useContentTitleBar` returns the element, `null` while the bar is still mounting, or `undefined`
when no surface lent one for this source. The slot is keyed by the source object, not by nesting:
only the renderer drawing that exact source sees it, so a fence or an embed inside the file, being
a source of its own, never takes over the surface's bar. `attachmentCard` lends its card's bar.

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
isPatchFile(f)  // text/x-patch, text/x-diff, or .patch / .diff under a generic type
isTextEmbed(f)  // a text file that is not also an image (.svg is both)
formatSize(bytes) // "512 B", "1.5 KB", "20 KB"
TEXT_PREVIEW_MAX_BYTES      // 1 MiB: text past this previews only when asked, and plain
TEXT_PREVIEW_HARD_MAX_BYTES // 10 MiB: text past this never previews
textPreviewGate({ name, mime?, size }, { max?, hardMax? }) // "auto" | "ask" | "refuse"
```

`textPreviewGate` is the rule the viewer and `attachmentCard` apply: a text file up to `max`
previews on its own, one up to `hardMax` waits for "Preview anyway", and a larger one never
previews. A patch skips the asking, since its view is drawn per file.

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
  patchContent,
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
| `imageContent()` | images with a `url` | both | `<img>`; in a document, a click opens the viewer; in the viewer, a zoomable canvas |
| `htmlContent({ src? })` | HTML with a `url` | `viewer` | `<iframe sandbox="allow-scripts">` |
| `pdfContent({ src? })` | PDF with a `url` | `viewer` | `<iframe>`, unsandboxed |
| `videoContent()` | video with a `url` | both | `VideoPlayer`; in a document, under a header with the name and Download |
| `audioContent()` | audio with a `url` | both | `AudioPlayer`; in a document, under a header with the file's icon, name and Download |

A file with no `url` is never accepted by the binary renderers, and falls through to the
registry's fallback. In a document an HTML file is text, so `attachmentCard` frames its source; a
PDF embed is the fallback's download link.

**Never add `allow-same-origin` to the HTML frame.** A file served from the app's own origin could
then run scripts that call the app's API with the reader's cookies. `allow-scripts` alone keeps the
document on an opaque origin. The PDF frame carries no sandbox because Chromium's PDF viewer refuses
to run in a sandboxed frame, so serve PDFs from a URL that cannot be mistaken for the app.

A video or audio file the browser cannot play (an `.avi`, a `.wma`) falls through to the renderers
after `videoContent`/`audioContent`, usually the download link, with "This browser can't play this
file." under it.

### Video and audio players

`VideoPlayer` and `AudioPlayer` are the players the renderers draw, for use on their own: a native
`<video>`/`<audio>` without native controls, an optional `header` above, and `MediaControls` from
`@orz/ui` underneath.

```tsx
import { VideoPlayer } from "@orz/ui-content/attachment";

<VideoPlayer
  src={url}
  title="clip.webm"
  header={<MyHeader />}
  onError={() => setUnplayable(true)}
/>;
```

- Props: `src`, `title` (the accessible name and the frame's `title`), `header`, `autoPlay`,
  `loop`, `speed` (the initial speed) and `className`. The video preloads metadata only.
- `onError` is called when the element cannot load or decode `src`, and the player then draws
  nothing; without it, the player says "This browser can't play this file." in place of the
  picture (for audio, the bar).
- A video adds picture-in-picture and fullscreen where the document offers them. Fullscreen takes
  the whole frame, so the bar stays.
- Keys, anywhere in the frame unless the focused control uses the key itself (a slider its arrows,
  a button Space): Space or `k` plays and pauses, ← → seek 5 s, `0`–`9` jump to tenths of the
  duration, `m` mutes, `f` toggles fullscreen. A handled key is `preventDefault()`ed, so inside the
  viewer an arrow key on the focused picture seeks rather than paging.

`attachmentCard`:

- past the depth limit (`maxDepth`, else the provider's `maxDepth`, else 1, counted as
  `markdownContent` counts it) it draws an `AttachmentLink` chip instead of a frame, so a document
  inside a card shows its own documents as links;
- over `maxBytes` (default `TEXT_PREVIEW_MAX_BYTES`, 1 MiB) it draws the frame with "Large files
  aren't previewed automatically." and a Preview anyway button, then the body once asked (a patch
  is not asked about); over `hardMaxBytes` (default `TEXT_PREVIEW_HARD_MAX_BYTES`, 10 MiB) it draws
  the frame with a note and no body. A file of unknown size is not capped here; the renderer `Next`
  reaches decides once the text is loaded (`codeContent` draws text over 1 MiB without
  highlighting);
- otherwise it draws the frame with the size, a download button and, inside a provider, an expand
  button that opens the viewer. Loading and load errors are drawn by the renderer `Next` reaches,
  which may also put controls in the frame's title bar (`useContentTitleBar`).

### The viewer

```ts
<AttachmentViewerProvider
  viewHref={(file) => string | undefined}   // where a browser tab shows the file
  group={(file) => ({ items, index }) | null} // the set paging covers when one file is opened
  textPreviewMaxBytes={1024 * 1024}          // text above this waits for "Preview anyway"
  textPreviewHardMaxBytes={10 * 1024 * 1024} // text above this never previews
  imageLook={{ background, smoothing }}      // controlled image look; default: held in memory
  onImageLookChange={(look) => void}
>

useAttachmentViewer(): { open(items, index), show(file) } | null  // null outside a provider
useCanPreview(file): boolean   // whether a plain click should open the viewer
useViewHref(file): string      // viewHref(file) ?? file.url ?? ""
useStoredImageLook(storageKey): [ImageLook, (look: ImageLook) => void]
```

One provider owns one dialog, and everything below it opens that one. A nested provider shadows
the outer one, so a surface can page through its own set.

- **`viewHref`** is for an app that serves a separate inline-view URL beside the download URL.
  Anchors, the HTML and PDF frames and "Open in new tab" use it; Download always uses `url`. When it
  returns undefined, "Open in new tab" is left out.
- **`group`** lets a click on one file page through the set it belongs to, positioned on it. A file
  it returns null for opens alone.
- **`useCanPreview`** is true when some registered renderer accepts the file in `"viewer"`
  placement and, for a text file, its size is known. A text file over `textPreviewMaxBytes` opens
  on "Large files aren't previewed automatically." with Preview anyway, which holds until the
  viewer pages away; one over `textPreviewHardMaxBytes` opens on "This file is too large to
  preview.", with the footer's Download. A patch is not asked about. HTML is not capped: the
  browser streams it into the frame rather than this tab drawing it as text. HTML that no frame
  takes (no `htmlContent`, or no `url`) reaches the text renderers, which apply their own cap. `attachmentCard` draws
  its expand button only when this holds.

The dialog shows the name, ‹ n / m › for a set (← and → page, wrapping), a maximize toggle that
fills the window and stays a modal, and the close button, all in one row. Its body is `<Content placement="viewer">`, or a download pane
for a file nothing can draw. The body sets `--attachment-pane-height` (`75vh`, or the remaining
height when maximized); a renderer in `"viewer"` placement sizes to it, as in
`max-h-(--attachment-pane-height)`. The title bar lends the renderer drawing the file a slot
between the name and the pager, through `ContentTitleBar`, for controls of its own.
`AttachmentViewer` is the same dialog, controlled, for an app that holds `{ items, index } | null`
itself, and takes the same `imageLook` props.

An image in the viewer sits on a canvas. The wheel zooms about the pointer, as do a trackpad pinch
(ctrl+wheel, or Safari's gesture events) and a two-finger pinch on a phone; dragging pans once
zoomed; a click toggles between fit and actual pixels (or twice the fit, if that is deeper) at the
pointer. Zoom runs from fit, or 100% if that is smaller, to 8× natural pixels, and panning never
pulls an image edge inside the canvas. Restored, fit never enlarges an image; maximized, it fills
the window. Paging starts every image at fit; maximize keeps the zoom and the point at the centre.
Restored, the canvas asks for the image's height at its zoom, so zooming in grows the dialog up to
the pane's height before it pans, and the height tweens as it changes (not under
`prefers-reduced-motion`). While the mouse is over the zoom controls or ‹ ›, the canvas keeps the
height it had when the pointer arrived, so the controls do not slide out from under it; it lets go
400 ms after the pointer leaves, or at once on a key, a press or a wheel.

In the title bar, − and + step the zoom (hidden on a phone, where pinch does it), and the readout
opens a menu: Fit (key `0`), 100% (key `1`), a black or checkerboard background, and smooth or
pixelated scaling. `+` `-` `0` `1` work from the keyboard; with Ctrl/⌘ they stay the browser's page
zoom. Black fills the canvas; the checkerboard sits under the image only, so an opaque image looks
the same and a transparent one shows where it ends. Pixelated applies only above 100%. An image that
fails to load is a plain `<img>`, with no controls.

The background and scaling (`ImageLook`, default checkerboard and smooth) are the viewer's, not
the image's, so paging and reopening keep them. Without `imageLook` the viewer holds them in memory
until the page reloads. `useStoredImageLook(storageKey)` keeps them in localStorage and follows
other tabs; hand its pair to `imageLook` and `onImageLookChange`, and name the key after the app.

### Links, lists, cards and icons

- **`<AttachmentLink file boxed? className?>`** is an inline link wearing the file's type icon. It is
  a real anchor to `useViewHref(file)`, so copy-link and middle-click work; a plain left click on a
  file `useCanPreview` accepts opens the viewer. `boxed` draws it as a bordered chip. It is a
  `LinkChip` from `@orz/ui/components/link-chip`, which also exports the chip's classes. A file
  marked `deleted` is its name struck through, with no link.
- **`<AttachmentList items actions? title? id? className?>`** lists files (`FileSource` plus a
  `key` and an optional ISO `createdAt`) with their icon, size, time and a download button.
  `actions(item)` draws the app's own controls at the end of a row, such as a delete button. A list
  of eight or more keeps its newest five rows and folds the rest behind a toggle. A plain click on a
  row opens the viewer on the whole list. An empty list renders nothing.
- **`<DeletedAttachmentMark name className?>`** is what a document shows for a link or embed of a
  deleted file: the name struck through, with the word "deleted". `@orz/ui-markdown`'s
  `attachmentLinks` and `markdownEmbeds` draw it for a file their `resolve` marks `deleted`.
- **`<DocumentCard name icon? meta? headerActions? titleBarFor? downloadUrl? onExpand? collapsedClassName?>`**
  is the frame `attachmentCard` draws, for anything else that wants it: a header with the name, a
  muted note, extra actions, download and expand, around a height-capped body that offers "Show full
  document" when it overflows. Without `onExpand` it draws no expand controls. With `titleBarFor`,
  it lends a spot in the header, after the name, to the renderer drawing that source.
- **`fileIcon(file)`** is the lucide icon for a file's kind: image, HTML, patch, text, archive,
  audio, video, else a generic file.

`@orz/ui-markdown`'s `attachmentLinks` plugin draws markdown links to files as `AttachmentLink`s.
