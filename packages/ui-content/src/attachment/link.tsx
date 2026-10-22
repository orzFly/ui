import { cn } from "@orz/ui/lib/utils";
import type { MouseEvent, ReactNode } from "react";
import { fileIcon } from "./icon.ts";
import {
  type FileSource,
  useAttachmentViewer,
  useCanPreview,
  useViewHref,
} from "./viewer.tsx";

/**
 * `.markdown-body a` underlines every link, and a border saying "clickable"
 * on top of an underline says it twice; hover takes over what the underline
 * was for. The utilities layer is emitted after the components layer that
 * rule lives in, so `no-underline` wins without a specificity fight.
 */
export const RICH_CHIP_SKIN =
  "rounded-sm border bg-muted/40 px-[0.3em] py-px no-underline hover:border-ring hover:bg-muted focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * `items-baseline` is what puts the attachment title's baseline on the
 * paragraph's: every child then shares one baseline, and the container
 * reports it as its own. Measured at 1024px and 390px, the title sits 0.00px
 * off the surrounding text; `align-items: center` or the flex default puts it
 * 2.39px out.
 *
 * `leading-[1.2]` is how tall the chip is drawn. Against the body's 1.6 it
 * has room to spare, and vscode's 1.25 does not — that one overruns the line
 * by 0.11px.
 *
 * `-my-[2px]` is how tall the line has to think it is. The drawn box is
 * `1.2em` plus RICH_CHIP_SKIN's `border` and `py-px`, and a heading's line is
 * `1.25em`, so leading alone only fits wherever `4px` is under `0.05em` —
 * every heading under 80px was 2.59–3.13px taller than its chipless
 * neighbour (T-498). A line box measures an atomic inline by its margin box,
 * so giving those 4px back as margin is what the line reads, while the
 * border box still paints where the baseline puts it: unchanged at the
 * body's 22.39px, and T-460's 0.00px title baseline with it. The 2px is the
 * skin's own border and padding per side, so neither may move without this
 * following.
 */
export const RICH_CHIP_STRUCTURE =
  "inline-flex max-w-full items-baseline gap-[0.24em] align-baseline -my-[2px] leading-[1.2] whitespace-nowrap";

/**
 * `self-center` sits the icon beside the text rather than above it: an SVG
 * has no baseline of its own, so under `items-baseline` it would hang its
 * whole box off the shared one, 1px taller a chip with the glyph riding high.
 *
 * `1em`, because a chip inside a heading is drawn at the heading's font size
 * and a glyph in `rem` stays at the body's — 14px beside 28px text (T-495).
 */
export const RICH_CHIP_ICON = "inline size-[1em] self-center";

/**
 * `overflow: hidden` degrades an inline box's baseline to its bottom edge but
 * leaves a flex item's alone, which is why the label is a child of the chip
 * rather than the chip itself.
 */
export const RICH_CHIP_LABEL = "min-w-0 flex-initial truncate";

/** Modifier-clicks (new tab, forced download) keep native link behavior. */
export function isPlainLeftClick(e: MouseEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}

export type AttachmentLinkProps = {
  file: FileSource;
  /** A bordered chip; default false, underlined on hover. */
  boxed?: boolean;
  className?: string;
  /** Default: the file's name. */
  children?: ReactNode;
};

/**
 * An inline link to a file, wearing its type icon. A real anchor, so
 * copy-link and middle-click keep working; a plain click on a file the viewer
 * can draw opens the viewer instead.
 */
export function AttachmentLink({
  file,
  boxed = false,
  className,
  children,
}: AttachmentLinkProps) {
  const viewer = useAttachmentViewer();
  const canPreview = useCanPreview(file);
  const href = useViewHref(file);
  const Icon = fileIcon(file);

  return (
    <a
      href={href === "" ? undefined : href}
      // The label shares the chip's truncating child, so a long filename is
      // cut where it used to wrap and stay whole.
      title={file.name}
      className={cn(
        RICH_CHIP_STRUCTURE,
        boxed ? RICH_CHIP_SKIN : "hover:underline",
        className,
      )}
      onClick={(e) => {
        if (viewer !== null && canPreview && isPlainLeftClick(e)) {
          e.preventDefault();
          viewer.show(file);
        }
      }}
    >
      <Icon className={RICH_CHIP_ICON} />
      <span className={RICH_CHIP_LABEL}>{children ?? file.name}</span>
    </a>
  );
}
