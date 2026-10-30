import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { LoadFailure } from "@orz/ui/components/load-failure";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import {
  blobSource,
  bytesSource,
  createHexDocument,
  type HexCopyResult,
  type HexDocument,
  type HexEditMode,
  HexEditor,
  HexInspector,
  type HexPasteResult,
  type HexSelection,
  type HexViewHandle,
  useHexDocumentState,
} from "@orz/ui-hex";
import {
  DownloadIcon,
  FolderOpenIcon,
  Redo2Icon,
  RotateCcwIcon,
  ScanSearchIcon,
  Undo2Icon,
} from "lucide-react";
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  bytes,
  describeEdits,
  download,
  loadSample,
  SAMPLES,
} from "./files.ts";
import { parseStructure, type Region, regionPath } from "./structure.ts";
import {
  StructureList,
  StructureSelect,
  type StructureState,
} from "./structure-nav.tsx";

/** The file on screen. */
interface Opened {
  name: string;
  doc: HexDocument;
  /** New for every open and revert, so the editor starts afresh even on a file of the same name. */
  id: number;
}

let opens = 0;

/** A sample being fetched; `attempt` lets Retry ask for the same one again. */
interface Fetching {
  name: string;
  attempt: number;
  error?: string;
}

const PASTE_REFUSED: Record<
  Extract<HexPasteResult, { ok: false }>["reason"],
  string
> = {
  "not-hex": "Nothing pasted: the clipboard holds no hex digits",
  unencodable: "Nothing pasted: the text pane's encoding cannot write it",
  empty: "Nothing pasted: the clipboard is empty",
  "read-only": "Nothing pasted: the file is read-only",
};

function reportPaste(result: HexPasteResult) {
  if (!result.ok) toast.error(PASTE_REFUSED[result.reason]);
  else if (result.truncated) {
    toast.warning(`Pasted ${bytes(result.bytes)}; the rest ran past the end`);
  }
}

function reportCopy(result: HexCopyResult) {
  if (result.ok) return;
  toast.error(
    result.reason === "too-large"
      ? "Not copied: the selection is too large for the clipboard"
      : "Not copied: the clipboard refused it",
  );
}

/** Changes on every edit, undo and redo, where `useHexDocumentState` only follows what a toolbar shows. */
function useEdits(doc: HexDocument | undefined): number {
  const [edits, setEdits] = useState(0);
  useEffect(() => doc?.subscribe(() => setEdits((n) => n + 1)), [doc]);
  return edits;
}

/**
 * A hex editor for one file at a time: a sample, or one of the reader's own, opened with the
 * button or dropped on the screen and read in the browser alone. A PNG or a ZIP lists its chunks
 * and headers beside the bytes, and picking one selects its bytes; the inspector reads the
 * selection as numbers and text. Edits download as a new file. On a phone the structure is a
 * `Select` above the bytes and the inspector a sheet from the bottom bar.
 */
export function BinaryInspector() {
  const [fetching, setFetching] = useState<Fetching | null>({
    name: SAMPLES[0] ?? "",
    attempt: 0,
  });
  const [opened, setOpened] = useState<Opened | null>(null);
  const [selection, setSelection] = useState<HexSelection | null>(null);
  const [mode, setMode] = useState<HexEditMode>("overwrite");
  const [littleEndian, setLittleEndian] = useState(true);
  const [structure, setStructure] = useState<{
    doc: HexDocument;
    state: StructureState;
  } | null>(null);
  const [reverting, setReverting] = useState(false);
  // What opening another file would do, held while the reader decides about unsaved edits.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);
  const editor = useRef<HexViewHandle>(null);
  const picker = useRef<HTMLInputElement>(null);

  const doc = opened?.doc;
  const edits = useEdits(doc);
  const { dirty, canUndo, canRedo } = useHexDocumentState(doc ?? PLACEHOLDER);
  const changes = doc ? describeEdits(doc) : "";
  // The document the structure was last read for, so a new file reads at once and an edit waits.
  const parsedFor = useRef<HexDocument | null>(null);

  const show = useCallback((name: string, next: HexDocument) => {
    setOpened({ name, doc: next, id: ++opens });
    setSelection(null);
    setStructure({ doc: next, state: { kind: "reading" } });
  }, []);

  useEffect(() => {
    if (!fetching || fetching.error !== undefined) return;
    const controller = new AbortController();
    loadSample(fetching.name, controller.signal).then(
      (loaded) => {
        if (controller.signal.aborted) return;
        show(fetching.name, createHexDocument(bytesSource(loaded)));
        setFetching(null);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setFetching({ ...fetching, error: String(error) });
      },
    );
    return () => controller.abort();
  }, [fetching, show]);

  // Read again after each edit, once the typing pauses: an edit can rename a chunk or cut one short.
  useEffect(() => {
    if (!doc) return;
    const controller = new AbortController();
    const delay = parsedFor.current === doc && edits > 0 ? 300 : 0;
    const timer = setTimeout(() => {
      parseStructure(doc, controller.signal).then(
        (parsed) => {
          // The first read of a file sets the inspector to the byte order the format uses.
          if (parsedFor.current !== doc) {
            parsedFor.current = doc;
            setLittleEndian(parsed?.littleEndian ?? true);
          }
          setStructure({
            doc,
            state: parsed
              ? { kind: "parsed", structure: parsed }
              : { kind: "none" },
          });
        },
        () => {
          if (!controller.signal.aborted) {
            setStructure({ doc, state: { kind: "none" } });
          }
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [doc, edits]);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  /** Runs `open` now, or once the reader agrees to drop the open file's edits. */
  const guard = (open: () => void) => {
    if (doc?.dirty) setLeaving(() => open);
    else open();
  };

  const openSample = (name: string) =>
    guard(() => setFetching({ name, attempt: 0 }));

  // Read where it lies, a slice at a time: nothing is uploaded, and a large file opens at once.
  const openFile = (file: File) =>
    guard(() => {
      setFetching(null);
      show(file.name, createHexDocument(blobSource(file)));
    });

  const structureState =
    structure && structure.doc === doc
      ? structure.state
      : ({ kind: "reading" } as const);
  const regions =
    structureState.kind === "parsed" ? structureState.structure.regions : [];
  const path = selection
    ? regionPath(
        regions,
        Math.min(selection.anchor, selection.focus),
        Math.max(selection.anchor, selection.focus),
      )
    : [];

  const pick = (region: Region) => {
    setSelection({
      anchor: region.offset,
      focus: region.offset + Math.max(region.length, 1) - 1,
      pane: "hex",
    });
    editor.current?.scrollToOffset(region.offset, "start");
  };

  const revert = () => {
    if (!opened) return;
    show(opened.name, createHexDocument(opened.doc.source));
    setReverting(false);
    toast.success(`Reverted ${opened.name}`);
  };

  const save = () => {
    if (!opened) return;
    download(opened.doc, opened.name).catch((error: unknown) =>
      toast.error(`Not downloaded: ${String(error)}`),
    );
  };

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) openFile(file);
  };

  const name = fetching?.name ?? opened?.name ?? "";
  const filePicker = (
    <FilePicker
      name={name}
      onSample={openSample}
      onOpen={() => picker.current?.click()}
    />
  );
  const inspector = doc && (
    <HexInspector
      source={doc}
      selection={selection}
      littleEndian={littleEndian}
      onLittleEndianChange={setLittleEndian}
    />
  );

  let body: ReactNode;
  if (fetching?.error !== undefined) {
    body = (
      <LoadFailure
        message={`${fetching.name} did not load.`}
        detail={fetching.error}
        onRetry={() =>
          setFetching({ name: fetching.name, attempt: fetching.attempt + 1 })
        }
        retrying={false}
        className="m-auto"
      />
    );
  } else if (fetching || !doc) {
    body = (
      <div aria-busy className="grid gap-2 p-3">
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
          <Skeleton key={i} className="h-5 w-full max-w-xl" />
        ))}
      </div>
    );
  } else {
    body = (
      <HexEditor
        key={opened?.id}
        ref={editor}
        document={doc}
        mode={mode}
        onModeChange={setMode}
        selection={selection}
        onSelectionChange={setSelection}
        columns="auto"
        onPaste={reportPaste}
        onCopy={reportCopy}
        aria-label={`Bytes of ${name}`}
        className="h-full"
      />
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping is a shortcut for Open file.
    <div
      className="relative flex h-full flex-col"
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      <input
        ref={picker}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openFile(file);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="File and structure"
          className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex"
        >
          <div className="grid gap-2 border-b p-3">{filePicker}</div>
          <h2 className="px-3 pt-3 pb-1 font-medium text-muted-foreground text-ui-sm">
            Structure
          </h2>
          <nav
            aria-label="Structure"
            className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
          >
            {doc && !fetching && (
              <StructureList state={structureState} path={path} onPick={pick} />
            )}
          </nav>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="grid gap-2 border-b p-2 md:hidden">
            {filePicker}
            {doc && !fetching && (
              <StructureSelect
                state={structureState}
                path={path}
                onPick={pick}
                className="w-full"
              />
            )}
          </div>
          <div className="flex min-h-0 flex-1 p-2 md:p-3">{body}</div>
        </main>
        <aside
          aria-label="Inspector"
          className="hidden w-72 shrink-0 overflow-y-auto border-l p-3 lg:block"
        >
          {inspector}
        </aside>
      </div>
      <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3">
        <Segmented
          label="Typing"
          options={[
            { value: "overwrite", label: "Overwrite" },
            { value: "insert", label: "Insert" },
          ]}
          pressed={mode}
          onPress={setMode}
        />
        <p className="min-w-0 flex-1 truncate text-muted-foreground text-ui max-sm:order-last max-sm:basis-full">
          {doc && !fetching
            ? [
                dirty ? "Modified" : changes ? "Downloaded" : "Unmodified",
                changes,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""}
        </p>
        <TooltipProvider>
          <div className="ml-auto flex items-center gap-1">
            <Named label="Undo">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Undo"
                disabled={!doc || !canUndo}
                onClick={() => doc?.undo()}
              >
                <Undo2Icon />
              </Button>
            </Named>
            <Named label="Redo">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Redo"
                disabled={!doc || !canRedo}
                onClick={() => doc?.redo()}
              >
                <Redo2Icon />
              </Button>
            </Named>
            <Sheet>
              <Named label="Inspector">
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Inspector"
                    disabled={!doc}
                    className="lg:hidden"
                  >
                    <ScanSearchIcon />
                  </Button>
                </SheetTrigger>
              </Named>
              <SheetContent
                side="bottom"
                className="max-h-[85dvh] gap-0 overflow-y-auto"
              >
                <SheetTitle className="px-4 pt-4 text-base">
                  Inspector
                </SheetTitle>
                <SheetDescription className="sr-only">
                  The selected bytes read as numbers and text
                </SheetDescription>
                <div className="p-4">{inspector}</div>
              </SheetContent>
            </Sheet>
            <Button
              variant="ghost"
              size="sm"
              disabled={!changes || !!fetching}
              onClick={() => setReverting(true)}
            >
              <RotateCcwIcon />
              {/* Words on a phone too: nothing undoes a revert, and Download is what the bar is for. */}
              Revert…
            </Button>
            <Button size="sm" disabled={!doc || !!fetching} onClick={save}>
              <DownloadIcon />
              Download
            </Button>
          </div>
        </TooltipProvider>
      </footer>
      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-primary border-dashed bg-background/85 font-medium text-ui"
        >
          Drop to open it here. Nothing is uploaded.
        </div>
      )}
      <ConfirmDialog
        open={reverting}
        onOpenChange={setReverting}
        title={`Revert ${opened?.name ?? "the file"}?`}
        description={`Your edits to it (${changes}) are dropped, and Undo cannot bring them back. Download it first to keep a copy.`}
        confirmLabel="Revert"
        destructive
        onConfirm={revert}
      />
      <UnsavedChangesDialog
        open={leaving !== null}
        onProceed={() => {
          leaving?.();
          setLeaving(null);
        }}
        onStay={() => setLeaving(null)}
      />
    </div>
  );
}

/** Stands in for a document before the first file arrives, so the hook's call stays unconditional. */
const PLACEHOLDER = createHexDocument(bytesSource(new Uint8Array()));

function FilePicker({
  name,
  onSample,
  onOpen,
}: {
  name: string;
  onSample: (name: string) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex gap-2 md:grid">
      <Select value={name} onValueChange={onSample}>
        <SelectTrigger aria-label="File" className="min-w-0 flex-1 md:w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SAMPLES.map((sample) => (
            <SelectItem key={sample} value={sample}>
              {sample}
            </SelectItem>
          ))}
          {name && !SAMPLES.includes(name) && (
            <SelectItem value={name} disabled>
              {name}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onOpen}>
        <FolderOpenIcon />
        Open file…
      </Button>
      <p className="hidden text-muted-foreground text-ui-sm md:block">
        Or drop one here. It is read in your browser, never uploaded.
      </p>
    </div>
  );
}

/** The tooltip that shows an icon button's name, which its `aria-label` already carries. */
function Named({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A segmented switch: one pressed button per choice, as the theme menu's light/dark switch. */
function Segmented<T extends string>({
  label,
  options,
  pressed,
  onPress,
}: {
  label: string;
  options: { value: T; label: string }[];
  pressed: T;
  onPress: (value: T) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="grid grid-flow-col rounded-md bg-muted p-0.5"
    >
      {options.map(({ value, label: text }) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === pressed}
          onClick={() => onPress(value)}
          className="relative rounded-sm px-2.5 py-1 text-muted-foreground text-ui-sm transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:pressed-cue touch:hit-area"
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}
