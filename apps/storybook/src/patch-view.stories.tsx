import { Button } from "@orz/ui/components/button";
import { codeContent, PatchView, patchContent } from "@orz/ui-code";
import { useAttachmentViewer } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { PATCHES } from "./fixtures/files.ts";
import seriesText from "./fixtures/patch/series.patch?raw";

const VIEWER = `import { codeContent, patchContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider, useAttachmentViewer } from "@orz/ui-content/attachment";

const renderers = [patchContent, codeContent];

<ContentRenderers renderers={renderers}>
  <AttachmentViewerProvider>…</AttachmentViewerProvider>
</ContentRenderers>

// below the provider
const viewer = useAttachmentViewer();
viewer?.open([seriesPatch, pauseDiff, notesPatch], 0);`;

/**
 * A unified diff drawn as one diff per file, each commit's subject, author and message above its
 * files. The file list and the way back to the text as written are controls of the surface around
 * it: a card or viewer lends a spot in its title bar, and a fence, which has none, gets a frame
 * with one.
 */
const meta = {
  title: "ui-code/PatchView",
  component: PatchView,
  args: { filename: "series.patch", text: seriesText },
  argTypes: { titleBar: { control: false } },
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta<typeof PatchView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `PatchView` on its own, with no surrounding title bar: it frames itself. */
export const Playground: Story = {};

/** The files in the attachment viewer, where the diffs scroll within the pane. */
export const Viewer: Story = {
  decorators: [withViewer(), withRenderers(patchContent, codeContent)],
  parameters: { docs: { source: { code: VIEWER, language: "tsx" } } },
  render: function Render() {
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
  },
};
