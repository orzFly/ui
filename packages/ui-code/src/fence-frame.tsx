import { ToolbarButton } from "@orz/ui/components/toolbar";
import { writeClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  FileCode2Icon,
  FoldVerticalIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** Lines past which a code block in a document may be capped to scroll in its frame. */
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
 * from `writeClipboard`.
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
        className="text-muted-foreground"
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
      className="group/title flex min-w-0 items-center gap-1.5 text-foreground no-underline"
    >
      <FileCode2Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono text-ui-sm group-hover/title:underline">
        {title}
      </span>
    </a>
  );
}

/**
 * A code block's frame: an edge, Copy, and either the block's language in a toolbar that shows on
 * hover, or, when the block names a file, a standing header whose filename downloads it. The
 * content is the children's alone, with no padding or fill of its own, so a highlighted block, a
 * diagram or a diff sits in it on its own terms; a code view inside reads `useInFenceFrame` and
 * leaves the frame and Copy to it.
 */
export function FenceFrame({
  text,
  lang,
  title,
  leading,
  collapsible = false,
  toolbarAlwaysVisible = false,
  actions,
  className,
  children,
}: {
  /** What Copy and the download hand over: the block as written. Without it, no Copy. */
  text?: string;
  /** Shown in the floating toolbar; a header's filename says it instead. */
  lang?: string;
  /** A filename: draws the header, with a download of `text`, in place of the floating toolbar. */
  title?: string;
  /**
   * Controls or a label at the header's start; draws the header as `title` does. A floating
   * toolbar would sit on the corner of whatever the frame shows.
   */
  leading?: ReactNode;
  /** Caps the content's height to scroll inside the frame, with Expand to lift the cap. */
  collapsible?: boolean;
  /** For a toolbar that is the only way to something, as a diagram's way to its source. */
  toolbarAlwaysVisible?: boolean;
  /** More controls, before Expand and Copy. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const controls = (
    <>
      {actions}
      {collapsible && (
        <ToolbarButton
          type="button"
          size="icon-xs"
          aria-label={expanded ? "Collapse" : "Expand"}
          title={expanded ? "Collapse" : "Expand"}
          className="text-muted-foreground"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <FoldVerticalIcon /> : <UnfoldVerticalIcon />}
        </ToolbarButton>
      )}
      {text !== undefined && <CopyButton text={text} />}
    </>
  );
  const headed = title !== undefined || leading !== undefined;
  return (
    // Under raymond a read-only field: a sunken well in the window colour,
    // its header a band of the face along the top, as a patch's frame is.
    <div
      data-slot="fence-frame"
      className={cn(
        "group/fence relative overflow-hidden rounded-frame ring-1 ring-border raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:ring-0 raymond:[--background:var(--window)]",
        className,
      )}
    >
      {headed ? (
        <div
          data-slot="fence-head"
          // On touch as tall as a hit area, since the frame clips; its
          // buttons' own margins leave the room at its end.
          className="flex items-center gap-2 border-b bg-muted py-1 pr-1.5 pl-2 text-ui-sm text-muted-foreground select-none touch:min-h-11 raymond:border-b-0 raymond:bg-(--3d-face)"
        >
          {leading}
          {title !== undefined &&
            (text !== undefined ? (
              <FenceTitleLink title={title} text={text} />
            ) : (
              <span className="truncate font-mono text-foreground">
                {title}
              </span>
            ))}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {controls}
          </span>
        </div>
      ) : (
        // Where hover hides it, it floats over the corner, so a block at
        // rest costs no height; shown, it may cover the end of a long first
        // line, hence opaque. Where it never hides (no hover, or a toolbar
        // that is the only way to something) that cover would be for good,
        // so it takes a row of its own, reaching down into the content's
        // top padding to cost less, but not over a scroller, whose lines
        // would pass under it. On touch it sits down from the top far
        // enough for its controls' hit areas to end inside the frame; their
        // own margins keep them in from its side.
        <div
          data-slot="fence-tools"
          data-always={toolbarAlwaysVisible ? "" : undefined}
          className={cn(
            "relative z-10 mt-1 mr-1 ml-auto flex w-fit touch:mt-hit-xs items-center gap-0.5 rounded-control border bg-background p-px shadow-menu select-none print:hidden raymond:rounded-none raymond:border-0 raymond:bg-(--3d-face) raymond:p-0.5 raymond:shadow-raised",
            !collapsible && "-mb-3",
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
        {collapsible ? (
          // Capped here rather than through the code view's className: a
          // view virtualizes against its own box, so this way every line
          // stays in the DOM and find-in-page still scrolls the box to a
          // hit past the cap. 20 lines of pierre's 20px and its 8px above and
          // below, or half the screen where that is shorter.
          <section
            data-slot="fence-scroll"
            data-expanded={expanded ? "" : undefined}
            // A box that scrolls has to be focusable for the keyboard to
            // scroll it.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: see above
            tabIndex={0}
            aria-label="Code"
            className={cn(
              "overflow-auto [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring print:max-h-none",
              !expanded && "max-h-[min(416px,50vh)]",
            )}
          >
            {children}
          </section>
        ) : (
          children
        )}
      </InFrameContext.Provider>
    </div>
  );
}
