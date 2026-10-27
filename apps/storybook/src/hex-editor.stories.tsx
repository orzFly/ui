import {
  reportCopy,
  reportPaste,
  SAMPLE_PNG,
  syntheticSource,
} from "@orz/fixtures/hex.ts";
import { Button } from "@orz/ui/components/button";
import {
  blobSource,
  bytesSource,
  createHexDocument,
  type HexDocument,
  type HexEditMode,
  HexEditor,
  type HexEditorProps,
  HexInspector,
  type HexSelection,
  useHexDocumentState,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Redo2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { withHeight } from "./decorators.tsx";

async function download(doc: HexDocument, name: string) {
  const blob = await doc.toBlob("application/octet-stream");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  doc.markSaved();
}

const PLAYGROUND = `import { bytesSource, createHexDocument, HexEditor } from "@orz/ui-hex";
import "@orz/ui-hex/styles.css";

const doc = useMemo(() => createHexDocument(bytesSource(bytes)), [bytes]);

<HexEditor document={doc} rows={16} onPaste={(result) => …} onCopy={(result) => …} />`;

const TOOLBAR = `const { size, dirty, canUndo, canRedo } = useHexDocumentState(doc);

<Button disabled={!canUndo} onClick={() => doc.undo()}>Undo</Button>
<Button disabled={!canRedo} onClick={() => doc.redo()}>Redo</Button>
<Button onClick={async () => { save(await doc.toBlob()); doc.markSaved(); }}>Download</Button>
<HexEditor document={doc} mode={mode} onModeChange={setMode} />`;

const FROM_FILE = `const doc = useMemo(() => createHexDocument(blobSource(file)), [file]);

<HexEditor key={file.name} document={doc} />`;

const LOCKED_SIZE = `const doc = useMemo(() => createHexDocument(bytesSource(bytes), { resizable: false }), [bytes]);

<HexEditor document={doc} />`;

const WITH_INSPECTOR = `const [selection, setSelection] = useState<HexSelection | null>(null);

<HexEditor document={doc} selection={selection} onSelectionChange={setSelection} />
<HexInspector source={doc} selection={selection} />`;

// `document` is required, yet it cannot be an arg: each story needs its own
// instance, and a copied plain object would fail the editor's brand checks.
// So the stories take every prop but it, and each render supplies one.
type Args = Omit<HexEditorProps, "document">;

// The meta is typed against the component, not `Args`: `Meta<Args>` wants a
// `ComponentType<Args>`, which a component requiring `document` is not. Meta
// args are partial, so `document` is not demanded there.
const meta = {
  title: "ui-hex/HexEditor",
  // The document is made per story, inside its render.
  component: HexEditor,
  args: {
    rows: 16,
    columns: 16,
    groupSize: 8,
    showAddresses: true,
    showColumnLabels: true,
    showText: true,
    showStatusBar: true,
    uppercase: true,
    fadeZeroBytes: true,
    readOnly: false,
    onPaste: reportPaste,
    onCopy: reportCopy,
  },
  argTypes: {
    mode: { control: false },
    defaultMode: { control: false },
    selection: { control: false },
    defaultSelection: { control: false },
  },
} satisfies Meta<typeof HexEditor>;

export default meta;
type Story = StoryObj<Args>;

export const Playground: Story = {
  parameters: { docs: { source: { code: PLAYGROUND, language: "tsx" } } },
  render: function Render(args) {
    const doc = useMemo(() => createHexDocument(bytesSource(SAMPLE_PNG)), []);
    return <HexEditor {...args} document={doc} />;
  },
};

export const Toolbar: Story = {
  parameters: { docs: { source: { code: TOOLBAR, language: "tsx" } } },
  render: function Render(args) {
    const doc = useMemo(() => createHexDocument(bytesSource(SAMPLE_PNG)), []);
    const [mode, setMode] = useState<HexEditMode>("overwrite");
    const { size, dirty, canUndo, canRedo } = useHexDocumentState(doc);
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canUndo}
            onClick={() => doc.undo()}
          >
            <Undo2 /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canRedo}
            onClick={() => doc.redo()}
          >
            <Redo2 /> Redo
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!doc.resizable}
            aria-pressed={mode === "insert"}
            onClick={() => setMode(mode === "insert" ? "overwrite" : "insert")}
          >
            {mode === "insert" ? "Insert" : "Overwrite"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(doc, "sample.png").catch((error: unknown) =>
                toast.error(`Export failed: ${String(error)}`),
              )
            }
          >
            <Download /> Download
          </Button>
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span
              aria-hidden
              className={`size-2 rounded-full ${dirty ? "bg-destructive" : "bg-muted-foreground/30"}`}
            />
            {dirty ? "Unsaved changes" : "Saved"} · {size} bytes
          </span>
        </div>
        <HexEditor
          {...args}
          document={doc}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    );
  },
};

export const FromFile: Story = {
  parameters: { docs: { source: { code: FROM_FILE, language: "tsx" } } },
  render: function Render(args) {
    const [file, setFile] = useState<File | null>(null);
    const doc = useMemo(
      () =>
        createHexDocument(file ? blobSource(file) : bytesSource(SAMPLE_PNG)),
      [file],
    );
    return (
      <div className="grid gap-3">
        <input
          type="file"
          aria-label="Open a file"
          className="text-sm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <HexEditor
          key={
            file ? `${file.name}:${file.size}:${file.lastModified}` : "sample"
          }
          {...args}
          document={doc}
        />
      </div>
    );
  },
};

export const LockedSize: Story = {
  args: {
    defaultSelection: {
      anchor: SAMPLE_PNG.length - 2,
      focus: SAMPLE_PNG.length - 2,
      pane: "hex",
    },
  },
  parameters: { docs: { source: { code: LOCKED_SIZE, language: "tsx" } } },
  render: function Render(args) {
    const doc = useMemo(
      () =>
        createHexDocument(bytesSource(SAMPLE_PNG.slice()), {
          resizable: false,
        }),
      [],
    );
    return <HexEditor {...args} document={doc} />;
  },
};

export const WithInspector: Story = {
  parameters: { docs: { source: { code: WITH_INSPECTOR, language: "tsx" } } },
  render: function Render(args) {
    const doc = useMemo(() => createHexDocument(bytesSource(SAMPLE_PNG)), []);
    const [selection, setSelection] = useState<HexSelection | null>({
      anchor: 0x10,
      focus: 0x10,
      pane: "hex",
    });
    return (
      <div className="flex flex-wrap items-start gap-6">
        <HexEditor
          {...args}
          document={doc}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <HexInspector className="w-72" source={doc} selection={selection} />
      </div>
    );
  },
};

export const LargePaged: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withHeight(460)],
  render: function Render(args) {
    const doc = useMemo(
      () =>
        createHexDocument(syntheticSource({ size: 2 ** 32, latencyMs: 80 })),
      [],
    );
    return (
      <HexEditor {...args} document={doc} aria-label="4 GiB paged editor" />
    );
  },
};
