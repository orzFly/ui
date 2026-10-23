import { Button } from "@orz/ui/components/button";
import { codeContent, PatchView, patchContent } from "@orz/ui-code";
import { ContentRenderers, type ContentSource } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  attachmentCard,
  type FileSource,
  useAttachmentViewer,
} from "@orz/ui-content/attachment";
import {
  attachmentLinks,
  Markdown,
  markdownContent,
  markdownEmbeds,
} from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import seriesText from "./fixtures/patch/series.patch?raw";

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

const PLAIN_DIFF = `diff --git a/src/retry.ts b/src/retry.ts
index d1e5c0a..e2f6a1b 100644
--- a/src/retry.ts
+++ b/src/retry.ts
@@ -1,4 +1,4 @@
-const PAUSE_MS = 250;
+const PAUSE_MS = 500;
 
 /** Runs \`attempt\`, and once more after a pause if it throws. */
 export async function retryOnce<T>(attempt: () => Promise<T>): Promise<T> {
`;

const FILES: Record<string, FileSource> = {
  "series.patch": textFile("series.patch", "text/x-patch", seriesText),
  // The CLI uploads code under a generic type; the name makes it a patch.
  "pause.diff": textFile("pause.diff", "application/octet-stream", PLAIN_DIFF),
  "notes.patch": textFile(
    "notes.patch",
    "text/x-patch",
    "Not a diff at all, just notes\nsomeone saved as .patch.\n",
  ),
};

const file = (name: string) => FILES[name] as FileSource;

function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  return FILES[href.slice("files/".length)] ?? null;
}

const RENDERERS = [
  attachmentCard(),
  markdownContent(),
  patchContent,
  codeContent,
];

const PLUGINS = [markdownEmbeds({ resolve }), attachmentLinks({ resolve })];

function Surface({ children }: { children: ReactNode }) {
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <div className="max-w-3xl">{children}</div>
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}

const FENCES = `A fence tagged \`diff\` holding a patch is drawn as its files, in a frame with the controls:

\`\`\`diff
${PLAIN_DIFF}\`\`\`

A bare +/- snippet is not a patch, and stays highlighted text without a complaint:

\`\`\`diff
-const PAUSE_MS = 250;
+const PAUSE_MS = 500;
\`\`\`
`;

const EMBEDS = `A \`git format-patch\` series, embedded. The file list and *raw* sit in the card's title bar:

![](files/series.patch)

A plain diff uploaded as \`application/octet-stream\`, recognised by its name:

![](files/pause.diff)

A \`.patch\` that is not one says so:

![](files/notes.patch)
`;

function FencesDemo({ source }: { source: string }) {
  return (
    <Surface>
      <Markdown plugins={PLUGINS}>{source}</Markdown>
    </Surface>
  );
}

/**
 * `@orz/ui-code`'s `patchContent` draws a unified diff, from a ```` ```diff ```` / ```` ```patch ````
 * fence or a `.patch` / `.diff` file, as one diff per file under each commit's subject and
 * message, with a file list and a *raw* toggle back to the text as written.
 */
const meta = {
  title: "ui-code/Patch",
  component: FencesDemo,
  args: { source: FENCES },
} satisfies Meta<typeof FencesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fences: Story = {};

/** Patch files in attachment cards, which lend their title bar to the patch's controls. */
export const AttachmentCards: Story = { args: { source: EMBEDS } };

function ViewerButtons() {
  const viewer = useAttachmentViewer();
  const items = Object.values(FILES);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((f, index) => (
        <Button
          key={f.name}
          variant="outline"
          size="sm"
          onClick={() => viewer?.open(items, index)}
        >
          {f.name}
        </Button>
      ))}
    </div>
  );
}

/** The same files in the attachment viewer, where the diffs scroll within the pane. */
export const Viewer: Story = {
  render: () => (
    <Surface>
      <ViewerButtons />
    </Surface>
  ),
};

/** `PatchView` on its own, with no surrounding title bar: it frames itself. */
export const Standalone: Story = {
  render: () => (
    <div className="max-w-3xl">
      <PatchView filename={file("series.patch").name} text={seriesText} />
    </div>
  ),
};
