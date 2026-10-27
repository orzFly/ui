import { file, PATCHES } from "@orz/fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { codeContent } from "@orz/ui-code";
import {
  Content,
  type ContentProps,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  useContentDepth,
  useContentDisplayOf,
  useContentMaxDepth,
} from "@orz/ui-content";
import {
  attachmentCard,
  audioContent,
  htmlContent,
  imageContent,
  pdfContent,
  videoContent,
} from "@orz/ui-content/attachment";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

/** Accepts inline text tagged `shout` only: a narrow renderer, so it goes first. */
const shout: ContentRenderer = {
  name: "shout",
  accepts: (source) => source.kind === "inline" && source.lang === "shout",
  display: "inline",
  Component: ({ source, className }) => (
    <strong className={className} style={{ letterSpacing: "0.05em" }}>
      {source.kind === "inline" ? source.text.toUpperCase() : null}
    </strong>
  ),
};

/** Accepts every file and frames whatever the renderers after it draw. */
const framed: ContentRenderer = {
  name: "framed",
  accepts: (source) => source.kind === "file",
  Component: ({ Next, ...props }) => (
    <figure className="my-2 rounded-lg border p-3">
      <Next {...props} />
      <figcaption className="mt-2 text-xs text-muted-foreground">
        drawn by “framed”, then handed to Next
      </figcaption>
    </figure>
  ),
};

const TOYS = withRenderers(shout, framed);

type Row = { label: string; source: ContentSource };

const ROWS: Row[] = [
  {
    label: "Inline, lang “shout”: the first renderer accepts it",
    source: { kind: "inline", text: "hello there", lang: "shout" },
  },
  {
    label: "Inline, lang “ts”: nothing accepts it, so the <pre> fallback",
    source: { kind: "inline", text: "const answer = 42;", lang: "ts" },
  },
  {
    label: "File with a url: framed, then Next reaches the download link",
    source: { kind: "file", name: "report.zip", url: "#report.zip" },
  },
  {
    label: "File without a url: framed, then Next reaches the bare name",
    source: { kind: "file", name: "notes.bin" },
  },
];

/** Draws a `.nest` file inside itself, until the registry's `maxDepth` says stop. */
const nest: ContentRenderer = {
  name: "nest",
  accepts: (source) => source.kind === "file" && source.name.endsWith(".nest"),
  Component: ({ source }) => {
    const depth = useContentDepth();
    const max = useContentMaxDepth() ?? 1;
    if (depth > max) {
      return (
        <span>
          stops at depth {depth}: past maxDepth {max}
        </span>
      );
    }
    return (
      <div className="border-l-2 pl-3">
        depth {depth} of {max}
        <Content source={source} placement="document" />
      </div>
    );
  },
};

const NEST = [nest];

// withRenderers takes no maxDepth, and only this page sets one.
const maxDepth2: Decorator = (Story) => (
  <ContentRenderers renderers={NEST} maxDepth={2}>
    <Story />
  </ContentRenderers>
);

const IMAGE = imageContent();
const HTML = htmlContent();
const PDF = pdfContent();
const VIDEO = videoContent();
const AUDIO = audioContent();
const CARD = attachmentCard();

// A frame renderer fills the viewer's pane; on a docs page that pane needs a height.
const paneHeight: Decorator = (Story) => (
  <div style={{ "--attachment-pane-height": "24rem" } as CSSProperties}>
    <Story />
  </div>
);

const renderRows = (args: ContentProps) => (
  <div className="flex flex-col gap-4 text-sm">
    {ROWS.map((row) => (
      <section key={row.label} className="flex flex-col gap-1">
        <h3 className="font-medium">{row.label}</h3>
        <Content source={row.source} placement={args.placement} />
      </section>
    ))}
  </div>
);

const TOY_RENDERERS = `const shout: ContentRenderer = {
  name: "shout",
  accepts: (source) => source.kind === "inline" && source.lang === "shout",
  display: "inline",
  Component: ({ source, className }) => (
    <strong className={className}>
      {source.kind === "inline" ? source.text.toUpperCase() : null}
    </strong>
  ),
};

// Takes every file, frames it, and hands it on to the renderers after it.
const framed: ContentRenderer = {
  name: "framed",
  accepts: (source) => source.kind === "file",
  Component: ({ Next, ...props }) => (
    <figure>
      <Next {...props} />
      <figcaption>drawn by “framed”, then handed to Next</figcaption>
    </figure>
  ),
};`;

const PLAYGROUND = `import { Content, type ContentRenderer, ContentRenderers } from "@orz/ui-content";

${TOY_RENDERERS}

// A narrow renderer goes first: the first one that accepts a source draws it.
const renderers = [shout, framed];

<ContentRenderers renderers={renderers}>
  <Content source={{ kind: "inline", text: "hello there", lang: "shout" }} placement="document" />
</ContentRenderers>`;

const DISPATCH = `import { Content, ContentRenderers } from "@orz/ui-content";

const renderers = [shout, framed];

<ContentRenderers renderers={renderers}>
  <Content source={{ kind: "inline", text: "hello there", lang: "shout" }} placement="document" />
  <Content source={{ kind: "file", name: "report.zip", url: "/files/report.zip" }} placement="document" />
</ContentRenderers>`;

const FALLBACKS = `import { Content, ContentFallback } from "@orz/ui-content";

// no renderers registered: ContentFallback draws it
<Content source={{ kind: "inline", text: "const answer = 42;", lang: "ts" }} placement="document" />

// Inside a renderer's Component, a renderer stepping aside:
return <ContentFallback {...props} />;`;

const DEPTH = `import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  useContentDepth,
  useContentMaxDepth,
} from "@orz/ui-content";

const nest: ContentRenderer = {
  name: "nest",
  accepts: (source) => source.kind === "file" && source.name.endsWith(".nest"),
  Component: ({ source }) => {
    // File sources drawn by a renderer around this point, this one included.
    const depth = useContentDepth();
    // The nearest <ContentRenderers maxDepth>; <Content> itself never enforces it.
    const max = useContentMaxDepth() ?? 1;
    if (depth > max) return <span>stops at depth {depth}: past maxDepth {max}</span>;
    return (
      <div>
        depth {depth} of {max}
        <Content source={source} placement="document" />
      </div>
    );
  },
};

const renderers = [nest];

<ContentRenderers renderers={renderers} maxDepth={2}>
  <Content source={{ kind: "file", name: "chain.nest" }} placement="document" />
</ContentRenderers>`;

const DISPLAY = `import { useContentDisplay, useContentDisplayOf } from "@orz/ui-content";

const display = useContentDisplay(source, "document"); // "block" | "inline" | null
const displayOf = useContentDisplayOf(); // one function for many sources in one render`;

const code = (snippet: string) => ({
  docs: { source: { code: snippet, language: "tsx" } },
});

const CARD_SNIPPET = registrationSnippet({
  renderers: [
    ["@orz/ui-content/attachment", "attachmentCard()"],
    ["@orz/ui-markdown", "markdownContent()"],
    ["@orz/ui-code", "patchContent"],
    ["@orz/ui-code", "codeContent"],
  ],
  uses: [
    ["@orz/ui-content", "Content"],
    ["@orz/ui-content/attachment", "AttachmentViewerProvider"],
  ],
  body: '<AttachmentViewerProvider>\n  <Content source={file} placement="document" />\n</AttachmentViewerProvider>',
});

const IMAGE_SNIPPET = registrationSnippet({
  renderers: [["@orz/ui-content/attachment", "imageContent()"]],
  uses: [
    ["@orz/ui-content", "Content"],
    ["@orz/ui-content/attachment", "AttachmentViewerProvider"],
  ],
  body: '<AttachmentViewerProvider>\n  <Content source={file} placement="document" />\n</AttachmentViewerProvider>',
});

const frameSnippet = (renderer: string) =>
  registrationSnippet({
    renderers: [["@orz/ui-content/attachment", renderer]],
    uses: [["@orz/ui-content", "Content"]],
    body: '<Content source={file} placement="viewer" /> {/* viewer placement only */}',
  });

const mediaSnippet = (renderer: string) =>
  registrationSnippet({
    renderers: [["@orz/ui-content/attachment", renderer]],
    uses: [["@orz/ui-content", "Content"]],
    body: '<Content source={file} placement="document" />',
  });

/**
 * `<Content>` draws a source with the first registered renderer that accepts it. Renderers are
 * registered with `<ContentRenderers>`; a renderer's `Next` draws the same source with the ones
 * after it, and the built-in fallback ends the list.
 */
const meta = {
  title: "ui-content/Content",
  component: Content,
  args: {
    source: { kind: "inline", text: "hello there", lang: "shout" },
    placement: "document",
  },
  argTypes: {
    placement: { control: "inline-radio", options: ["document", "viewer"] },
  },
  decorators: [withWidth("max-w-xl")],
} satisfies Meta<typeof Content>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A toy inline renderer and a frame that hands every file to `Next`. */
export const Playground: Story = {
  decorators: [TOYS],
  parameters: code(PLAYGROUND),
};

/** One registry, four sources: the first renderer that accepts each one draws it. */
export const Dispatch: Story = {
  render: renderRows,
  decorators: [TOYS],
  parameters: code(DISPATCH),
};

/** With no `<ContentRenderers>` around them, every source reaches the built-in fallback. */
export const Fallbacks: Story = {
  render: renderRows,
  parameters: code(FALLBACKS),
};

/**
 * A renderer that draws its file inside itself. `useContentDepth` counts the files drawn around
 * it, and `useContentMaxDepth` reads the registry's `maxDepth`, which is where it stops.
 */
export const Depth: Story = {
  args: { source: { kind: "file", name: "chain.nest" } },
  decorators: [maxDepth2],
  parameters: code(DEPTH),
};

/**
 * How each source would lay out, asked without drawing it: `"inline"`, `"block"`, or `null` when
 * no renderer accepts it. A paragraph asks this before it decides to stay a `<p>`.
 */
export const Display: Story = {
  render: function Render(args) {
    const displayOf = useContentDisplayOf();
    return (
      <table className="text-sm">
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b align-top">
              <td className="py-2 pr-4">{row.label}</td>
              <td className="py-2 pr-4 font-mono">
                {displayOf(row.source, args.placement) ?? "null"}
              </td>
              <td className="py-2">
                <Content source={row.source} placement={args.placement} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  decorators: [TOYS],
  parameters: code(DISPLAY),
};

/**
 * `attachmentCard` frames a file embedded in a document and hands it to the renderer that draws
 * it: markdown, code, and patches, which put their controls in the card's title bar.
 */
export const AttachmentCard: Story = {
  render: () => (
    <div className="flex flex-col">
      {[file("appendix.md"), file("fetch-task.ts"), ...PATCHES].map((f) => (
        <Content key={f.name} source={f} placement="document" />
      ))}
    </div>
  ),
  decorators: [withViewer({}), withRenderers(...ATTACHMENT_RENDERERS)],
  parameters: code(CARD_SNIPPET),
};

/** Text over the card's size cap is not loaded: the card says so and offers the download. */
export const AttachmentCardTooLarge: Story = {
  args: {
    source: {
      ...file("fetch-task.ts"),
      name: "generated.ts",
      size: 2 * 1024 * 1024,
    },
  },
  decorators: [withRenderers(CARD, codeContent)],
  tags: ["edge", "!autodocs"],
};

/** An image in a document; a click opens it in the viewer, where it zooms and pans. */
export const Image: Story = {
  args: { source: file("gradient.png") },
  decorators: [withViewer({}), withRenderers(IMAGE)],
  parameters: code(IMAGE_SNIPPET),
};

/** HTML in a sandboxed frame, on an opaque origin. Viewer placement only. */
export const Html: Story = {
  args: { source: file("demo.html"), placement: "viewer" },
  decorators: [paneHeight, withRenderers(HTML)],
  parameters: code(frameSnippet("htmlContent()")),
};

/** The browser's own PDF viewer in a frame. Viewer placement only. */
export const Pdf: Story = {
  args: { source: file("paper.pdf"), placement: "viewer" },
  decorators: [paneHeight, withRenderers(PDF)],
  parameters: code(frameSnippet("pdfContent()")),
};

export const Video: Story = {
  args: { source: file("clip.webm") },
  decorators: [withRenderers(VIDEO)],
  parameters: code(mediaSnippet("videoContent()")),
};

export const Audio: Story = {
  args: { source: file("tone.ogg") },
  decorators: [withRenderers(AUDIO)],
  parameters: code(mediaSnippet("audioContent()")),
};
