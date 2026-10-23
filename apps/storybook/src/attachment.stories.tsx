import { Button } from "@orz/ui/components/button";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import {
  type AttachmentItem,
  AttachmentLink,
  AttachmentList,
  AttachmentViewerProvider,
  attachmentCard,
  audioContent,
  htmlContent,
  imageContent,
  pdfContent,
  useAttachmentViewer,
  useStoredImageLook,
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
import guideText from "./fixtures/attachment/guide.md?raw";
import { file, group, MIXED, resolve } from "./fixtures/files.ts";

const RENDERERS = [
  attachmentCard(),
  imageContent(),
  htmlContent(),
  pdfContent(),
  videoContent(),
  audioContent(),
  markdownContent(),
  codeContent,
];

const PLUGINS = [markdownEmbeds({ resolve }), attachmentLinks({ resolve })];

function Surface({ children }: { children: ReactNode }) {
  const [imageLook, setImageLook] = useStoredImageLook(
    "orz-storybook-image-look",
  );
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider
        group={group}
        imageLook={imageLook}
        onImageLookChange={setImageLook}
      >
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
        inline preview. An image zooms with the wheel, a pinch, + − 0 1 or a
        click, and pans by dragging; its background and scaling are in the zoom
        menu.
      </p>
      <ViewerButtons />
    </Surface>
  );
}

const meta = {
  title: "ui-content/Attachment",
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

/**
 * The inline link, plain and boxed: a LinkChip wearing the file's type icon. A plain click opens
 * the viewer; a modifier click is the browser's.
 */
export const Link: Story = {
  name: "AttachmentLink",
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
