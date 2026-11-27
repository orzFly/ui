import { ToolbarButton } from "@orz/ui/components/toolbar";
import { writeClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import {
  ContentCollapse,
  ContentCollapseBody,
  ContentFrame,
  ContentHeader,
} from "@orz/ui-content/attachment";
import {
  CheckIcon,
  CopyIcon,
  FileCode2Icon,
  Maximize2Icon,
} from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** Lines past which a code block in a document is cut at the shared cap, behind Show all. */
export const FENCE_COLLAPSE_LINES = 30;

const COPIED_MS = 1500;

const InFrameContext = createContext(false);

/**
 * Whether this is drawn inside a `FenceFrame`'s content: a code view there leaves the frame, the
 * copy and the box to it.
 */
export function useInFenceFrame(): boolean {
  return useContext(InFrameContext);
}

/**
 * Copies `text` and answers on the button itself, a check for a moment and "Copied" for a screen
 * reader, rather than with a toast: the reader's eyes are already on it. A failure still toasts,
 * from `writeClipboard`. Its colour is the bar's it sits in, a `ContentHeader` or the frame's
 * floating toolbar.
 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <ToolbarButton
        type="button"
        size="icon-xs"
        aria-label="Copy"
        title="Copy"
        onClick={async () => {
          if (!(await writeClipboard(text))) return;
          clearTimeout(timer.current);
          setCopied(true);
          timer.current = setTimeout(() => setCopied(false), COPIED_MS);
        }}
      >
        {copied ? <CheckIcon data-icon="copied" /> : <CopyIcon />}
      </ToolbarButton>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

/**
 * The block's text as a file named `title`. A blob URL rather than `data:`, because a same-origin
 * blob can be opened top-level in a new tab and `data:` cannot. Made in an effect, not a memo:
 * StrictMode's remount runs the cleanup and would revoke a memoized URL the second mount still
 * renders.
 */
export function FenceTitleLink({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(
      new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [text]);
  return (
    <a
      href={url}
      download={title}
      title={title}
      className="text-foreground no-underline hover:underline"
    >
      {title}
    </a>
  );
}

/**
 * A code block's frame: an edge, Copy, and either the block's language in a toolbar that shows on
 * hover, or, when the block names a file, the header every named block takes, whose filename
 * downloads it. The content is the children's alone, with no padding or fill of its own, so a
 * highlighted block, a diagram or a diff sits in it on its own terms; a code view inside reads
 * `useInFenceFrame` and leaves the frame and Copy to it.
 */
export function FenceFrame({
  text,
  lang,
  title,
  icon,
  collapsible = false,
  onOpen,
  toolbarAlwaysVisible = false,
  actions,
  className,
  children,
}: {
  /** What Copy and the download hand over: the block as written. Without it, no Copy. */
  text?: string;
  /** Shown in the floating toolbar, or as the header's name without a `title`. */
  lang?: string;
  /** A filename: draws the header, with a download of `text`, in place of the floating toolbar. */
  title?: string;
  /**
   * The marker's icon; given, draws the header even without a title, with `lang` as its name.
   * Default: `FileCode2`.
   */
  icon?: ReactNode;
  /**
   * Cuts a long block at the shared cap, with a bar that shows the rest. `true` (a count known
   * up front): from the first frame, the bar naming `text`'s line count. `"measure"`: once the
   * content proves taller than 1.5 times the cap.
   */
  collapsible?: boolean | "measure";
  /** Opens the block in the viewer: a ⤢ in the header, and the bar opens it instead of expanding. */
  onOpen?: () => void;
  /** For a toolbar that is the only way to something, as a diagram's way to its source. */
  toolbarAlwaysVisible?: boolean;
  /** More controls, before ⤢ and Copy. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const controls = (
    <>
      {actions}
      {onOpen !== undefined && (
        <ToolbarButton
          type="button"
          size="icon-xs"
          aria-label="Open in the viewer"
          title="Open in the viewer"
          onClick={onOpen}
        >
          <Maximize2Icon />
        </ToolbarButton>
      )}
      {text !== undefined && <CopyButton text={text} />}
    </>
  );
  const headed = title !== undefined || icon !== undefined;
  return (
    // Under raymond a read-only field: the frame's sunken well, its header
    // and bar bands of the face along the top and the bottom.
    <ContentFrame
      data-slot="fence-frame"
      className={cn("group/fence", className)}
    >
      <ContentCollapse
        collapse={collapsible}
        onOpen={onOpen}
        lines={
          collapsible === true && text !== undefined
            ? text.split("\n").length
            : undefined
        }
      >
        {headed ? (
          <ContentHeader
            icon={icon ?? <FileCode2Icon />}
            name={
              title === undefined ? undefined : text !== undefined ? (
                <FenceTitleLink title={title} text={text} />
              ) : (
                title
              )
            }
            lang={lang}
          >
            {controls}
          </ContentHeader>
        ) : (
          // Where hover hides it, it floats over the corner, so a block at
          // rest costs no height; shown, it may cover the end of a long
          // first line, hence opaque. Where it never hides (no hover, or a
          // toolbar that is the only way to something) that cover would be
          // for good, so it takes a row of its own, reaching down into the
          // content's top padding to cost less. On touch it sits down from
          // the top far enough for its controls' hit areas to end inside the
          // frame; their own margins keep them in from its side.
          <div
            data-slot="fence-tools"
            data-always={toolbarAlwaysVisible ? "" : undefined}
            className={cn(
              "relative z-10 mt-1 mr-1 -mb-3 ml-auto flex w-fit touch:mt-hit-xs items-center gap-0.5 rounded-control border bg-background p-px text-muted-foreground shadow-menu select-none print:hidden raymond:rounded-none raymond:border-0 raymond:bg-(--3d-face) raymond:p-0.5 raymond:text-foreground raymond:shadow-raised",
              !toolbarAlwaysVisible &&
                "transition-opacity duration-150 ease-out motion-reduce:transition-none can-hover:absolute can-hover:top-1 can-hover:right-1 can-hover:m-0 can-hover:opacity-0 can-hover:group-focus-within/fence:opacity-100 can-hover:group-hover/fence:opacity-100",
            )}
          >
            {lang !== undefined && lang !== "" && (
              <span className="px-1.5 font-mono text-ui-2xs text-muted-foreground">
                {lang}
              </span>
            )}
            {controls}
          </div>
        )}
        <InFrameContext.Provider value={true}>
          {/* Cut here rather than through the code view's className: a view
              virtualizes against its own box, so this way every line stays
              in the DOM and find in page still reaches a line past the cut. */}
          <ContentCollapseBody>{children}</ContentCollapseBody>
        </InFrameContext.Provider>
      </ContentCollapse>
    </ContentFrame>
  );
}
