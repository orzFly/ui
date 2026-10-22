import { Button } from "@orz/ui/components/button";
import {
  blobSource,
  bytesSource,
  createHexDocument,
  type HexCopyResult,
  type HexDocument,
  type HexEditMode,
  HexEditor,
  type HexEditorProps,
  HexInspector,
  type HexPasteResult,
  type HexSelection,
  useHexDocumentState,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Redo2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HexFrame, SAMPLE_PNG, syntheticSource } from "./hex-fixtures.tsx";

function reportPaste(result: HexPasteResult) {
  if (result.ok) {
    toast.success(
      `Pasted ${result.bytes} bytes${result.truncated ? ", truncated at the end" : ""}`,
    );
  } else {
    toast.error(`Paste refused: ${result.reason}`);
  }
}

function reportCopy(result: HexCopyResult) {
  if (result.ok) toast.success(`Copied ${result.bytes} bytes`);
  else toast.error(`Copy failed: ${result.reason}`);
}

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

function Toolbar({
  doc,
  mode,
  onModeChange,
  fileName,
}: {
  doc: HexDocument;
  mode: HexEditMode;
  onModeChange: (mode: HexEditMode) => void;
  fileName: string;
}) {
  const { size, dirty, canUndo, canRedo } = useHexDocumentState(doc);
  return (
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
        onClick={() => onModeChange(mode === "insert" ? "overwrite" : "insert")}
      >
        {mode === "insert" ? "Insert" : "Overwrite"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          download(doc, fileName).catch((error: unknown) =>
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
  );
}

type EditorArgs = Omit<HexEditorProps, "document" | "mode" | "onModeChange">;

function EditorDemo({
  doc,
  fileName,
  ...props
}: EditorArgs & { doc: HexDocument; fileName: string }) {
  const [mode, setMode] = useState<HexEditMode>("overwrite");
  return (
    <div className="grid gap-3">
      <Toolbar
        doc={doc}
        mode={mode}
        onModeChange={setMode}
        fileName={fileName}
      />
      <HexEditor
        {...props}
        document={doc}
        mode={mode}
        onModeChange={setMode}
        onPaste={reportPaste}
        onCopy={reportCopy}
      />
    </div>
  );
}

// The document is made inside each story, so the controls drive a demo that
// wraps HexEditor rather than HexEditor itself.
function BasicDemo(args: EditorArgs) {
  const doc = useMemo(() => createHexDocument(bytesSource(SAMPLE_PNG)), []);
  return <EditorDemo {...args} doc={doc} fileName="sample.png" />;
}

const meta = {
  title: "Hex/HexEditor",
  component: BasicDemo,
  decorators: [
    (Story) => (
      <HexFrame>
        <Story />
      </HexFrame>
    ),
  ],
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
  },
  argTypes: {
    defaultMode: { control: false },
  },
} satisfies Meta<typeof BasicDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

function LargePagedDemo() {
  const doc = useMemo(
    () => createHexDocument(syntheticSource({ size: 2 ** 32, latencyMs: 80 })),
    [],
  );
  return (
    <HexFrame height={460}>
      <EditorDemo
        doc={doc}
        fileName="synthetic.bin"
        aria-label="4 GiB paged editor"
        // A fixed height: the toolbar sits above it inside the frame.
        rows={16}
      />
    </HexFrame>
  );
}

export const LargePaged: Story = {
  render: () => <LargePagedDemo />,
};

function FromFileDemo() {
  const [file, setFile] = useState<File | null>(null);
  const doc = useMemo(
    () => createHexDocument(file ? blobSource(file) : bytesSource(SAMPLE_PNG)),
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
      <EditorDemo
        key={file ? `${file.name}:${file.size}:${file.lastModified}` : "sample"}
        doc={doc}
        fileName={file?.name ?? "sample.png"}
        rows={16}
      />
    </div>
  );
}

export const FromFile: Story = {
  render: () => <FromFileDemo />,
};

function LockedSizeDemo() {
  const doc = useMemo(
    () =>
      createHexDocument(bytesSource(SAMPLE_PNG.slice()), { resizable: false }),
    [],
  );
  return (
    <EditorDemo
      doc={doc}
      fileName="sample.png"
      rows={16}
      defaultSelection={{
        anchor: SAMPLE_PNG.length - 2,
        focus: SAMPLE_PNG.length - 2,
        pane: "hex",
      }}
    />
  );
}

export const LockedSize: Story = {
  render: () => <LockedSizeDemo />,
};

function WithInspectorDemo() {
  const doc = useMemo(() => createHexDocument(bytesSource(SAMPLE_PNG)), []);
  const [selection, setSelection] = useState<HexSelection | null>({
    anchor: 0x10,
    focus: 0x10,
    pane: "hex",
  });
  return (
    <div className="flex flex-wrap items-start gap-6">
      <HexEditor
        document={doc}
        rows={16}
        selection={selection}
        onSelectionChange={setSelection}
        onPaste={reportPaste}
        onCopy={reportCopy}
      />
      <HexInspector className="w-72" source={doc} selection={selection} />
    </div>
  );
}

export const WithInspector: Story = {
  render: () => <WithInspectorDemo />,
};
