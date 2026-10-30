import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogTitle,
} from "@orz/ui/components/dialog";
import { cn } from "@orz/ui/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import {
  type CSSProperties,
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatSize,
  isHtmlFile,
  isImageFile,
  isTextFile,
  TEXT_PREVIEW_HARD_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  textPreviewGate,
} from "../file-kind.ts";
import { Content, useContentDisplay } from "../registry.tsx";
import { ContentTitleBar } from "../title-bar.tsx";
import type { ContentSource } from "../types.ts";
import { fileIcon } from "./icon.ts";
import { DEFAULT_IMAGE_LOOK, type ImageLook } from "./image-look.ts";

export type FileSource = Extract<ContentSource, { kind: "file" }>;

// Long enough to cover a pointer crossing the image between two controls,
// short enough that leaving for good does not read as the viewer lagging.
const RELEASE_DELAY = 400;
const RELEASE_NOW = ["keydown", "pointerdown", "wheel"] as const;

/** What the viewer is showing: a set of files and a position in it. */
export type AttachmentViewerState = { items: FileSource[]; index: number };

export type AttachmentViewerControls = {
  /** Opens the viewer on `items[index]`, paging through `items`. */
  open(items: FileSource[], index: number): void;
  /** Opens the viewer on one file, paging through the set `group` gives it. */
  show(file: FileSource): void;
};

type ViewerContext = AttachmentViewerControls & {
  viewHref: ((file: FileSource) => string | undefined) | undefined;
  textPreviewMaxBytes: number;
  textPreviewHardMaxBytes: number;
};

const AttachmentViewerContext = createContext<ViewerContext | null>(null);

type ViewerImage = {
  /** Whether the dialog fills the window. */
  maximized: boolean;
  look: ImageLook;
  setLook(look: ImageLook): void;
  /** The last image's canvas height, so the next one tweens from it. */
  lastHeight: { current: number | null };
  /** The height the canvas keeps while the pointer is on the title-bar controls. */
  held: number | null;
};

const ViewerImageContext = createContext<ViewerImage | null>(null);

/** What the image renderer needs from the viewer around it; null outside one. */
export function useViewerImage(): ViewerImage | null {
  return useContext(ViewerImageContext);
}

type ImageLookProps = {
  /** The image background and scaling, controlled. Default: held in memory by the viewer. */
  imageLook?: ImageLook;
  /** Called when the reader picks another background or scaling. */
  onImageLookChange?(look: ImageLook): void;
};

export type AttachmentViewerProviderProps = {
  /** Where a browser tab shows this file; undefined when it would only download. */
  viewHref?: (file: FileSource) => string | undefined;
  /** The set paging covers when a single file is opened; null pages nothing. */
  group?: (file: FileSource) => AttachmentViewerState | null;
  /**
   * Text files above this wait for "Preview anyway" and then draw plain. Default 1 MiB. A text
   * file of unknown size stays a link until its size is known.
   */
  textPreviewMaxBytes?: number;
  /** Text files above this never preview; the viewer says so. Default 10 MiB. */
  textPreviewHardMaxBytes?: number;
  children?: ReactNode;
} & ImageLookProps;

/**
 * Owns one viewer dialog for everything below it: link chips, inline images,
 * list rows and document cards all open this one rather than mounting a
 * dialog each. A nested provider shadows the outer one.
 */
export function AttachmentViewerProvider({
  viewHref,
  group,
  textPreviewMaxBytes = TEXT_PREVIEW_MAX_BYTES,
  textPreviewHardMaxBytes = TEXT_PREVIEW_HARD_MAX_BYTES,
  imageLook,
  onImageLookChange,
  children,
}: AttachmentViewerProviderProps) {
  const [state, setState] = useState<AttachmentViewerState | null>(null);
  // Read at click time, so an inline `group` does not change `show` and
  // re-render every chip that holds it.
  const groupRef = useRef(group);
  groupRef.current = group;

  const open = useCallback(
    (items: FileSource[], index: number) => setState({ items, index }),
    [],
  );
  const show = useCallback(
    (file: FileSource) =>
      setState(groupRef.current?.(file) ?? { items: [file], index: 0 }),
    [],
  );
  const value = useMemo(
    () => ({
      open,
      show,
      viewHref,
      textPreviewMaxBytes,
      textPreviewHardMaxBytes,
    }),
    [open, show, viewHref, textPreviewMaxBytes, textPreviewHardMaxBytes],
  );

  return (
    <AttachmentViewerContext.Provider value={value}>
      {children}
      <AttachmentViewer
        state={state}
        onNavigate={(index) =>
          setState((prev) => (prev === null ? prev : { ...prev, index }))
        }
        onClose={() => setState(null)}
        imageLook={imageLook}
        onImageLookChange={onImageLookChange}
      />
    </AttachmentViewerContext.Provider>
  );
}

/** The nearest provider's controls, or null outside one. */
export function useAttachmentViewer(): AttachmentViewerControls | null {
  return useContext(AttachmentViewerContext);
}

/** Where an anchor to this file points: the provider's `viewHref`, else the file's `url`. */
export function useViewHref(file: FileSource): string {
  const viewer = useContext(AttachmentViewerContext);
  return viewer?.viewHref?.(file) ?? file.url ?? "";
}

/**
 * Whether the viewer has something to draw for this file, which is what
 * decides if a plain click on it is hijacked into the viewer. Text needs a
 * known size — a file whose size the app does not know yet stays a link
 * until it does; a size past the limits still opens the viewer, which says
 * why it shows nothing. HTML has no size cap: the browser streams it into
 * the iframe instead of this tab highlighting it.
 */
export function useCanPreview(file: FileSource): boolean {
  const display = useContentDisplay(file, "viewer");
  if (display === null) return false;
  if (isTextFile(file) && !isHtmlFile(file)) return file.size !== undefined;
  return true;
}

function useGate(file: FileSource): "auto" | "ask" | "refuse" {
  const viewer = useContext(AttachmentViewerContext);
  if (!isTextFile(file) || isHtmlFile(file) || file.size === undefined) {
    return "auto";
  }
  return textPreviewGate(
    { ...file, size: file.size },
    {
      max: viewer?.textPreviewMaxBytes,
      hardMax: viewer?.textPreviewHardMaxBytes,
    },
  );
}

/**
 * A text file past the auto-preview size waits to be asked, and is then
 * drawn: the code renderer draws text that large plain. Past the hard limit
 * it never previews.
 */
function LargeTextPane({
  gate,
  onPreview,
}: {
  gate: "ask" | "refuse";
  onPreview(): void;
}) {
  const viewer = useContext(AttachmentViewerContext);
  const hardMax =
    viewer?.textPreviewHardMaxBytes ?? TEXT_PREVIEW_HARD_MAX_BYTES;
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-ui text-muted-foreground">
      <FileIcon className="size-8" />
      {gate === "refuse" ? (
        <>
          <span className="font-medium text-foreground">
            This file is too large to preview.
          </span>
          <span>Previews stop at {formatSize(hardMax)}.</span>
        </>
      ) : (
        <>
          <span className="font-medium text-foreground">
            Large files aren't previewed automatically.
          </span>
          <Button variant="outline" size="sm" onClick={onPreview}>
            Preview anyway
          </Button>
        </>
      )}
    </div>
  );
}

/** Paging can land on types that only download — say so instead of a blank pane. */
function DownloadOnlyPane({ file }: { file: FileSource }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-ui text-muted-foreground">
      <FileIcon className="size-8" />
      <span className="font-medium text-foreground">{file.name}</span>
      <span>No inline preview for this file type.</span>
      {file.url !== undefined && (
        <a
          href={file.url}
          download={file.name}
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          <DownloadIcon className="size-3.5" />
          Download
        </a>
      )}
    </div>
  );
}

function ViewerBody({
  file,
  maximized,
  titleBar,
}: {
  file: FileSource;
  maximized: boolean;
  titleBar: HTMLElement | null;
}) {
  const canPreview = useCanPreview(file);
  const gate = useGate(file);
  // For this opening only: the body is keyed by file.
  const [asked, setAsked] = useState(false);
  return (
    <DialogBody
      // Inset as the title row and footer are: a renderer draws to its own
      // edges, and the scrollbar sits by it rather than on the frame.
      className={cn(
        "mx-0 overflow-auto px-0",
        maximized ? "flex-1" : "max-h-[75vh]",
      )}
      // A renderer in "viewer" placement no longer knows the pane it is drawn
      // in, so the pane hands down the height it may fill.
      style={
        {
          "--attachment-pane-height": maximized ? "100%" : "75vh",
        } as CSSProperties
      }
    >
      {!canPreview ? (
        <DownloadOnlyPane file={file} />
      ) : gate === "refuse" || (gate === "ask" && !asked) ? (
        <LargeTextPane gate={gate} onPreview={() => setAsked(true)} />
      ) : (
        <ContentTitleBar source={file} target={titleBar}>
          <Content source={file} placement="viewer" />
        </ContentTitleBar>
      )}
    </DialogBody>
  );
}

function ViewerFooter({ file }: { file: FileSource }) {
  const viewer = useContext(AttachmentViewerContext);
  const tab = viewer?.viewHref?.(file);
  return (
    <div className="flex items-center justify-between gap-3 text-ui-sm text-muted-foreground">
      <span className="truncate">
        {[
          file.mime,
          file.size !== undefined ? formatSize(file.size) : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {tab !== undefined && (
          <a
            href={tab}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            <ExternalLinkIcon className="size-3.5" />
            Open in new tab
          </a>
        )}
        {file.url !== undefined && (
          <a
            href={file.url}
            download={file.name}
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            <DownloadIcon className="size-3.5" />
            Download
          </a>
        )}
      </span>
    </div>
  );
}

function keepsArrowKeys(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, video, audio") !== null)
  );
}

export type AttachmentViewerProps = {
  /** null, or an index outside `items`: closed. */
  state: AttachmentViewerState | null;
  onNavigate(index: number): void;
  onClose(): void;
} & ImageLookProps;

/**
 * The viewer dialog, controlled: one file at a time drawn by the registry in
 * "viewer" placement, or a download pane when nothing can draw it. A set
 * pages with ‹ › / arrow keys, and the controls live in the title bar, never
 * floated over the content.
 */
export function AttachmentViewer({
  state,
  onNavigate,
  onClose,
  imageLook,
  onImageLookChange,
}: AttachmentViewerProps) {
  // "Maximize" fills the browser window without entering system fullscreen;
  // the dialog stays a modal.
  const [maximized, setMaximized] = useState(false);
  const [titleBar, setTitleBar] = useState<HTMLElement | null>(null);
  // Held here rather than in the image, so paging and reopening keep it.
  const [ownLook, setOwnLook] = useState(DEFAULT_IMAGE_LOOK);
  const look = imageLook ?? ownLook;
  const lastHeight = useRef<number | null>(null);

  const file = state?.items[state.index];
  const count = state?.items.length ?? 0;
  const isImage = file !== undefined && isImageFile(file);
  // Paging between images tweens from one's height to the next; from
  // anything else, including a closed viewer, the image lands at once.
  useEffect(() => {
    if (!isImage) lastHeight.current = null;
  }, [isImage]);

  // While the pointer is over − 100%▾ + or ‹ ›, the image keeps the height
  // it had when the pointer arrived, and takes its own once the pointer
  // leaves: the dialog is centred, so a height change slides the title bar
  // out from under the pointer, and the next click on + lands on the image
  // and toggles back to fit, or the next click on › misses. One region for
  // both groups, so crossing the gap between them is not a leave. Listened
  // to on the DOM rather than through React: the zoom controls are
  // portalled in by the image renderer, so in React's tree they sit outside
  // this region, while the zoom menu's items, portalled out to the body, sit
  // inside it — and choosing Fit or 100% there should not be held. Leaving
  // lets go only after RELEASE_DELAY, so a trip from one control to another
  // the long way round, over the image, is not a leave either; a key, a
  // press or a wheel in the meantime lets go at once, since the pointer is
  // no longer travelling.
  const [holdRegion, setHoldRegion] = useState<HTMLElement | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  useEffect(() => {
    if (holdRegion === null) return;
    let pending: number | undefined;
    const cancel = () => {
      window.clearTimeout(pending);
      pending = undefined;
      for (const type of RELEASE_NOW)
        window.removeEventListener(type, release, true);
    };
    const release = () => {
      cancel();
      setHeld(null);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (pending !== undefined) cancel();
      else setHeld(lastHeight.current);
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || pending !== undefined) return;
      pending = window.setTimeout(release, RELEASE_DELAY);
      for (const type of RELEASE_NOW)
        window.addEventListener(type, release, {
          capture: true,
          passive: true,
        });
    };
    holdRegion.addEventListener("pointerenter", enter);
    holdRegion.addEventListener("pointerleave", leave);
    return () => {
      cancel();
      holdRegion.removeEventListener("pointerenter", enter);
      holdRegion.removeEventListener("pointerleave", leave);
    };
  }, [holdRegion]);
  // Closing unmounts the region under the pointer, which never reports
  // leaving it.
  const open = file !== undefined;
  useEffect(() => {
    if (!open) setHeld(null);
  }, [open]);

  const image = useMemo(
    () => ({
      maximized,
      look,
      setLook: (next: ImageLook) => {
        if (imageLook === undefined) setOwnLook(next);
        onImageLookChange?.(next);
      },
      lastHeight,
      held,
    }),
    [maximized, look, imageLook, onImageLookChange, held],
  );

  const step = (delta: number) => {
    if (state === null || count < 2) return;
    onNavigate((state.index + delta + count) % count);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        onKeyDown={(e) => {
          // A focused video seeks, and a field moves its caret, on the same
          // keys: those belong to whatever the body drew.
          if (e.defaultPrevented || keepsArrowKeys(e.target)) return;
          if (e.key === "ArrowLeft") step(-1);
          if (e.key === "ArrowRight") step(1);
        }}
        className={cn(
          "flex flex-col bg-background",
          // Maximized: fill the viewport (clearing the centering translate)
          // but stay a modal — Esc still closes it. sm:max-w-none is needed
          // to beat the dialog's built-in sm:max-w-sm cap.
          maximized
            ? "top-0 left-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
            : "sm:max-w-5xl",
        )}
      >
        {file && (
          <>
            <div className="flex items-center gap-1">
              <DialogTitle
                className="min-w-0 flex-1"
                icon={createElement(fileIcon(file))}
              >
                <span className="min-w-0 truncate">{file.name}</span>
              </DialogTitle>
              <span
                ref={setHoldRegion}
                // Alone, the renderer's controls need no box; an empty one
                // would add a gap beside a lone file that shows none.
                className={cn(
                  "items-center gap-1",
                  count > 1 ? "flex" : "contents",
                )}
              >
                <span ref={setTitleBar} className="contents" />
                {count > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="previous attachment"
                      onClick={() => step(-1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <span className="text-ui-sm whitespace-nowrap text-muted-foreground tabular-nums">
                      {(state?.index ?? 0) + 1} / {count}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="next attachment"
                      onClick={() => step(1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={maximized ? "restore size" : "maximize"}
                onClick={() => setMaximized((m) => !m)}
              >
                {maximized ? <MinimizeIcon /> : <MaximizeIcon />}
              </Button>
              <DialogCloseButton />
            </div>
            {/* Keyed by file, so paging starts the next one scrolled to its top. */}
            <ViewerImageContext.Provider value={image}>
              <ViewerBody
                key={`${state?.index}:${file.url ?? file.name}`}
                file={file}
                maximized={maximized}
                titleBar={titleBar}
              />
            </ViewerImageContext.Provider>
            <ViewerFooter file={file} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
