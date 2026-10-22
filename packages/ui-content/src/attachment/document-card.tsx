import { cn } from "@orz/ui/lib/utils";
import { DownloadIcon, Maximize2Icon } from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { fileIcon } from "./icon.ts";

export type DocumentCardProps = {
  name: string;
  /** Default: `fileIcon({ name })`. */
  icon?: ComponentType<{ className?: string }>;
  /** Short muted note next to the name (e.g. a size). */
  meta?: ReactNode;
  /** Extra header controls, rendered before download/expand. */
  headerActions?: ReactNode;
  downloadUrl?: string;
  /** Opens the full document; without it the card draws no expand controls. */
  onExpand?: () => void;
  /** Height cap for the collapsed body. */
  collapsedClassName?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A bordered card with a filename header and a height-capped body. Generic on
 * purpose: an attachment embed puts the drawn file in it, and an app can put
 * anything else there, with version chips or review state in `headerActions`.
 */
export function DocumentCard({
  name,
  icon,
  meta,
  headerActions,
  downloadUrl,
  onExpand,
  collapsedClassName = "max-h-80",
  className,
  children,
}: DocumentCardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // The cap sits on the outer box, so growth of the inner content (lazy
  // code block upgrade, images loading) never resizes the observed border
  // box — observe the inner one.
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (outer === null || inner === null) return;
    const check = () =>
      setOverflowing(inner.offsetHeight > outer.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const Icon = icon ?? fileIcon({ name });
  const title = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span
        className={cn("truncate font-medium", onExpand && "hover:underline")}
      >
        {name}
      </span>
      {meta !== undefined && (
        <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
      )}
    </>
  );

  return (
    <section
      className={cn("my-2 overflow-hidden rounded-lg border", className)}
    >
      <div className="flex items-center gap-1 border-b bg-muted/40 py-1 pr-1.5 pl-3 text-sm">
        {onExpand ? (
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            {title}
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2 py-1">
            {title}
          </span>
        )}
        {headerActions}
        {downloadUrl !== undefined && (
          <a
            href={downloadUrl}
            download={name}
            aria-label={`download ${name}`}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <DownloadIcon className="size-3.5" />
          </a>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label={`expand ${name}`}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Maximize2Icon className="size-3.5" />
          </button>
        )}
      </div>
      <div
        ref={outerRef}
        className={cn("relative overflow-hidden", collapsedClassName)}
      >
        <div ref={innerRef} className="p-3">
          {children}
        </div>
        {overflowing &&
          (onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              className="absolute inset-x-0 bottom-0 flex h-16 cursor-pointer items-end justify-center bg-gradient-to-t from-background to-transparent pb-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Show full document
            </button>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
          ))}
      </div>
    </section>
  );
}
