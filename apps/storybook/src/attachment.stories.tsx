import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  type ContentProps,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  isTextFile,
  useSourceText,
} from "@orz/ui-content";
import {
  type AttachmentItem,
  AttachmentLink,
  AttachmentList,
  AttachmentViewerProvider,
  attachmentCard,
  audioContent,
  type FileSource,
  htmlContent,
  imageContent,
  pdfContent,
  useAttachmentViewer,
  videoContent,
} from "@orz/ui-content/attachment";
import {
  attachmentLinks,
  Markdown,
  markdownContent,
  markdownEmbeds,
} from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import appendixText from "./fixtures/attachment/appendix.md?raw";
import zipUrl from "./fixtures/attachment/bundle.zip?url&no-inline";
import chapterText from "./fixtures/attachment/chapter.md?raw";
import webmUrl from "./fixtures/attachment/clip.webm?url&no-inline";
import htmlText from "./fixtures/attachment/demo.html?raw";
import tsText from "./fixtures/attachment/fetch-task.ts?raw";
import pngUrl from "./fixtures/attachment/gradient.png?url&no-inline";
import guideText from "./fixtures/attachment/guide.md?raw";
import svgText from "./fixtures/attachment/logo.svg?raw";
import svgUrl from "./fixtures/attachment/logo.svg?url&no-inline";
import pdfUrl from "./fixtures/attachment/paper.pdf?url&no-inline";
import oggUrl from "./fixtures/attachment/tone.ogg?url&no-inline";

/**
 * A text file as an app would describe one: a `url` to download (a blob, here) and a `load` for
 * the renderers that need the text.
 */
function textFile(name: string, mime: string, text: string): FileSource {
  const blob = new Blob([text], { type: mime });
  return {
    kind: "file",
    name,
    mime,
    size: blob.size,
    url: URL.createObjectURL(blob),
    load: async () => text,
  };
}

const binary = (
  name: string,
  mime: string,
  url: string,
  size: number,
): FileSource => ({ kind: "file", name, mime, size, url });

const FILES: Record<string, FileSource> = {
  "gradient.png": binary("gradient.png", "image/png", pngUrl, 1510),
  "logo.svg": {
    ...textFile("logo.svg", "image/svg+xml", svgText),
    url: svgUrl,
  },
  // A blob, not a served asset: Vite's dev server answers an .html asset URL
  // with a 404. The sandboxed frame still runs it on an opaque origin.
  "demo.html": textFile("demo.html", "text/html", htmlText),
  "paper.pdf": binary("paper.pdf", "application/pdf", pdfUrl, 689),
  "clip.webm": binary("clip.webm", "video/webm", webmUrl, 10556),
  "tone.ogg": binary("tone.ogg", "audio/ogg", oggUrl, 4649),
  "guide.md": textFile("guide.md", "text/markdown", guideText),
  "chapter.md": textFile("chapter.md", "text/markdown", chapterText),
  "appendix.md": textFile("appendix.md", "text/markdown", appendixText),
  // Uploaded with a generic type: the name alone makes it text.
  "fetch-task.ts": textFile(
    "fetch-task.ts",
    "application/octet-stream",
    tsText,
  ),
  "bundle.zip": binary("bundle.zip", "application/zip", zipUrl, 182),
};

const file = (name: string) => FILES[name] as FileSource;

/** Every kind the viewer knows, plus one it does not. */
const MIXED = [
  "gradient.png",
  "logo.svg",
  "demo.html",
  "paper.pdf",
  "clip.webm",
  "tone.ogg",
  "guide.md",
  "fetch-task.ts",
  "bundle.zip",
].map(file);

function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  return FILES[href.slice("files/".length)] ?? null;
}

/** Pages a file opened on its own through the mixed set, when it is in it. */
function group(target: FileSource) {
  const index = MIXED.findIndex((f) => f.name === target.name);
  return index === -1 ? null : { items: MIXED, index };
}

/**
 * Stands in for `@orz/ui-code`'s renderer until it registers one: every other text file, as a
 * plain `<pre>`.
 */
const plainText: ContentRenderer = {
  name: "plain-text",
  accepts: (source) => source.kind === "file" && isTextFile(source),
  Component: function PlainText({ source, className }: ContentProps) {
    const text = useSourceText(source);
    return (
      <pre
        // A scrolling region has to be reachable by keyboard.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls, so it takes focus
        tabIndex={0}
        className={cn(
          "overflow-auto rounded-md bg-muted/40 p-3 text-xs",
          className,
        )}
      >
        {text.status === "ready"
          ? text.text
          : text.status === "error"
            ? text.error.message
            : "Loading…"}
      </pre>
    );
  },
};

const RENDERERS = [
  attachmentCard(),
  imageContent(),
  htmlContent(),
  pdfContent(),
  videoContent(),
  audioContent(),
  markdownContent(),
  plainText,
];

const PLUGINS = [markdownEmbeds({ resolve }), attachmentLinks({ resolve })];

function Surface({ children }: { children: ReactNode }) {
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider group={group}>
        {children}
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}

function ViewerButtons() {
  const viewer = useAttachmentViewer();
  return (
    <div className="flex max-w-xl flex-wrap gap-2">
      {MIXED.map((f, index) => (
        <Button
          key={f.name}
          variant="outline"
          size="sm"
          onClick={() => viewer?.open(MIXED, index)}
        >
          {f.name}
        </Button>
      ))}
    </div>
  );
}

function ViewerDemo() {
  return (
    <Surface>
      <p className="mb-3 max-w-xl text-sm text-muted-foreground">
        Open any file, then page with ‹ › or the arrow keys. The archive has no
        inline preview.
      </p>
      <ViewerButtons />
    </Surface>
  );
}

const meta = {
  title: "Attachment",
  component: ViewerDemo,
} satisfies Meta<typeof ViewerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One viewer over every kind: image, SVG, sandboxed HTML, PDF, video, audio, markdown, code, archive. */
export const Viewer: Story = {};

/**
 * A markdown document embedding an image, a source file and another markdown document, which
 * embeds one in turn. The second level is past the depth limit, so it is a link chip.
 */
export const EmbedsInMarkdown: Story = {
  render: () => (
    <Surface>
      <div className="max-w-2xl">
        <Markdown plugins={PLUGINS}>{guideText}</Markdown>
      </div>
    </Surface>
  ),
};

const LISTED: AttachmentItem[] = [
  "gradient.png",
  "demo.html",
  "paper.pdf",
  "clip.webm",
  "tone.ogg",
  "guide.md",
  "fetch-task.ts",
  "bundle.zip",
].map((name, i) => ({
  ...file(name),
  key: name,
  createdAt: `2026-09-01T0${i}:15:00Z`,
}));

/** Eight files: the newest five show, and the rest fold behind a toggle. */
export const List: Story = {
  render: () => (
    <Surface>
      <div className="max-w-xl">
        <AttachmentList items={LISTED} />
      </div>
    </Surface>
  ),
};

/** The inline link, plain and boxed. A plain click opens the viewer; a modifier click is the browser's. */
export const LinkChip: Story = {
  render: () => (
    <Surface>
      <div className="markdown-body flex max-w-xl flex-col gap-3">
        {[false, true].map((boxed) => (
          <p key={String(boxed)}>
            {boxed ? "Boxed:" : "Plain:"} see{" "}
            <AttachmentLink file={file("guide.md")} boxed={boxed} />, the{" "}
            <AttachmentLink file={file("gradient.png")} boxed={boxed}>
              gradient
            </AttachmentLink>{" "}
            and <AttachmentLink file={file("bundle.zip")} boxed={boxed} />.
          </p>
        ))}
      </div>
    </Surface>
  ),
};
