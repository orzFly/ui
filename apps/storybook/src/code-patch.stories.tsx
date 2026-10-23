import { Button } from "@orz/ui/components/button";
import { codeContent, PatchView, patchContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  attachmentCard,
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
import { file, PATCHES, PLAIN_DIFF, resolve } from "./fixtures/files.ts";
import seriesText from "./fixtures/patch/series.patch?raw";

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
  return (
    <div className="flex flex-wrap gap-2">
      {PATCHES.map((f, index) => (
        <Button
          key={f.name}
          variant="outline"
          size="sm"
          onClick={() => viewer?.open(PATCHES, index)}
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
