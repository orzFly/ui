import { file, group, MIXED } from "@orz/fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { Button } from "@orz/ui/components/button";
import { isTextFile } from "@orz/ui-content";
import {
  type AttachmentItem,
  AttachmentList,
  AttachmentViewerProvider,
  AttachmentViewer as AttachmentViewerView,
  TEXT_PREVIEW_HARD_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  useAttachmentViewer,
  useCanPreview,
  useStoredImageLook,
  useViewHref,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { argsUpdater } from "./args.ts";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";

const MIXED_ITEMS: AttachmentItem[] = MIXED.map((f) => ({ ...f, key: f.name }));

// Text whose size the app does not know yet.
const UNSIZED_TS = {
  ...file("fetch-task.ts"),
  name: "generated.ts",
  size: undefined,
};

/** About `bytes` of log lines, made on demand. */
function logLines(bytes: number): string {
  const line = (i: number) =>
    `2026-09-01T00:00:00Z worker-${i % 8} INFO request ${i} served in ${i % 97} ms\n`;
  const lines: string[] = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const next = line(i);
    lines.push(next);
    size += next.length;
  }
  return lines.join("");
}

const LARGE_ITEMS: AttachmentItem[] = [
  {
    kind: "file",
    key: "server.log",
    name: "server.log",
    mime: "text/plain",
    size: 3 * 1024 * 1024,
    load: async () => logLines(3 * 1024 * 1024),
  },
  {
    kind: "file",
    key: "dump.log",
    name: "dump.log",
    mime: "text/plain",
    size: 12 * 1024 * 1024,
    load: async () => logLines(12 * 1024 * 1024),
  },
];

const PLAYGROUND = `import { ContentRenderers } from "@orz/ui-content";
import {
  type AttachmentItem,
  AttachmentList,
  AttachmentViewerProvider,
  attachmentCard,
  imageContent,
  useStoredImageLook,
} from "@orz/ui-content/attachment";
import { markdownContent } from "@orz/ui-markdown";
import { codeContent } from "@orz/ui-code";

// The viewer draws each file through <Content>, so it needs the renderers above it.
const renderers = [attachmentCard(), imageContent(), markdownContent(), codeContent];

export function Attachments({ files }: { files: AttachmentItem[] }) {
  // The image viewer's background and scaling, remembered in localStorage under this key.
  const [imageLook, setImageLook] = useStoredImageLook("my-app-image-look");
  return (
    <ContentRenderers renderers={renderers}>
      <AttachmentViewerProvider imageLook={imageLook} onImageLookChange={setImageLook}>
        <AttachmentList items={files} />
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}`;

const USE_ATTACHMENT_VIEWER = `import { useAttachmentViewer } from "@orz/ui-content/attachment";

const viewer = useAttachmentViewer(); // null outside a provider
viewer?.open(files, index); // pages through files
viewer?.show(file); // pages through group(file)`;

const USE_CAN_PREVIEW = `import { useCanPreview } from "@orz/ui-content/attachment";

// false for text of unknown size, and for kinds no renderer draws in the viewer
const canPreview = useCanPreview(file);`;

const USE_VIEW_HREF = `import { AttachmentViewerProvider, useViewHref } from "@orz/ui-content/attachment";

<AttachmentViewerProvider
  viewHref={(file) => (isTextFile(file) ? \`https://app.example/files/\${file.name}\` : undefined)}
>
  …
</AttachmentViewerProvider>

// Below it: the provider's viewHref, else the file's url.
const href = useViewHref(file);`;

const code = (snippet: string) => ({
  docs: { source: { code: snippet, language: "tsx" } },
});

/**
 * Gives every attachment below it one viewer dialog: a click on a list row, a link or a card
 * opens the file there, drawn by the registered renderers in `"viewer"` placement.
 */
const meta = {
  title: "ui-content/AttachmentViewerProvider",
  component: AttachmentViewerProvider,
  args: {
    textPreviewMaxBytes: TEXT_PREVIEW_MAX_BYTES,
    textPreviewHardMaxBytes: TEXT_PREVIEW_HARD_MAX_BYTES,
  },
  argTypes: {
    viewHref: { control: false },
    group: { control: false },
    children: { control: false },
    imageLook: { control: false },
    onImageLookChange: { control: false },
  },
  decorators: [withWidth("max-w-xl"), withRenderers(...ATTACHMENT_RENDERERS)],
} satisfies Meta<typeof AttachmentViewerProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One viewer over every kind: image, SVG, sandboxed HTML, PDF, video, audio, markdown, code and
 * an archive, which has no preview and gets the download pane. Page with ‹ › or the arrow keys;
 * an image zooms with the wheel, a pinch, + − 0 1 or a click, and its background and scaling are
 * in the zoom menu.
 */
export const Playground: Story = {
  render: function Render(args) {
    const [imageLook, setImageLook] = useStoredImageLook(
      "orz-storybook-image-look",
    );
    return (
      <AttachmentViewerProvider
        {...args}
        group={group}
        imageLook={imageLook}
        onImageLookChange={setImageLook}
      >
        <AttachmentList items={MIXED_ITEMS} />
      </AttachmentViewerProvider>
    );
  },
  parameters: code(PLAYGROUND),
};

/**
 * Text past `textPreviewMaxBytes` (3 MB of log) waits for Preview anyway and is then drawn plain;
 * past `textPreviewHardMaxBytes` (12 MB) the viewer says it is too large and offers the download.
 */
export const TextPreviewLimits: Story = {
  render: (args) => (
    <AttachmentViewerProvider {...args}>
      <AttachmentList items={LARGE_ITEMS} />
    </AttachmentViewerProvider>
  ),
};

/** The nearest provider's controls: `open` pages through a list, `show` through `group(file)`. */
export const UseAttachmentViewer: Story = {
  name: "useAttachmentViewer",
  render: function Render() {
    const viewer = useAttachmentViewer();
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Open any file, then page with ‹ › or the arrow keys. The archive has
          no inline preview.
        </p>
        <div className="flex flex-wrap gap-2">
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
      </div>
    );
  },
  decorators: [withViewer({ group })],
  parameters: code(USE_ATTACHMENT_VIEWER),
};

/** Whether a plain click on a file opens the viewer, or falls through to the browser. */
export const UseCanPreview: Story = {
  name: "useCanPreview",
  render: function Render() {
    const png = useCanPreview(file("gradient.png"));
    const zip = useCanPreview(file("bundle.zip"));
    const unsized = useCanPreview(UNSIZED_TS);
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>gradient.png</dt>
        <dd className="font-mono">{String(png)}</dd>
        <dt>bundle.zip</dt>
        <dd className="font-mono">{String(zip)}</dd>
        <dt>generated.ts (size unknown)</dt>
        <dd className="font-mono">{String(unsized)}</dd>
      </dl>
    );
  },
  decorators: [withViewer({})],
  parameters: code(USE_CAN_PREVIEW),
};

/** Where an anchor to a file points: the provider's `viewHref`, else the file's own `url`. */
export const UseViewHref: Story = {
  name: "useViewHref",
  render: function Render() {
    const guide = useViewHref(file("guide.md"));
    const zip = useViewHref(file("bundle.zip"));
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>guide.md</dt>
        <dd className="font-mono break-all">{guide}</dd>
        <dt>bundle.zip</dt>
        <dd className="font-mono break-all">{zip}</dd>
      </dl>
    );
  },
  decorators: [
    withViewer({
      viewHref: (f) =>
        isTextFile(f) ? `https://app.example/files/${f.name}` : undefined,
    }),
  ],
  parameters: code(USE_VIEW_HREF),
};

/**
 * The dialog itself, controlled and with no provider: `state` says which file of which list is
 * open, and `null` closes it.
 */
export const AttachmentViewer: StoryObj<typeof AttachmentViewerView> = {
  args: { state: null },
  argTypes: { state: { control: false } },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <div className="flex flex-wrap gap-2">
        {MIXED.map((f, index) => (
          <Button
            key={f.name}
            variant="outline"
            size="sm"
            onClick={() => updateArgs({ state: { items: MIXED, index } })}
          >
            {f.name}
          </Button>
        ))}
        <AttachmentViewerView
          state={args.state ?? null}
          onNavigate={(index) =>
            args.state && updateArgs({ state: { ...args.state, index } })
          }
          onClose={() => updateArgs({ state: null })}
        />
      </div>
    );
  },
};
