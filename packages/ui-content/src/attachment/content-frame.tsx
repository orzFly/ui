import { ModuleMarker } from "@orz/ui/components/card";
import { cn } from "@orz/ui/lib/utils";
import type * as React from "react";

/**
 * The edge around a block in a document: a ring, and under raymond a sunken well in the window
 * colour, which sets `--background` to it for what is drawn inside.
 */
export function ContentFrame({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="content-frame"
      {...props}
      className={cn(
        "relative overflow-hidden rounded-frame ring-1 ring-border raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:ring-0 raymond:[--background:var(--window)]",
        className,
      )}
    />
  );
}

export type ContentHeaderProps = {
  /** The kind's icon, drawn in the module marker. */
  icon: React.ReactNode;
  /** The block's name: text, or the link or button it is. Monospace, truncated. */
  name?: React.ReactNode;
  /** Shown in place of a name, muted: a fence's language. */
  lang?: string;
  /** A short muted note after the name, such as a size. */
  meta?: React.ReactNode;
  /** The controls at the end: `ToolbarButton`s at `icon-xs`, a renderer's title-bar spot. */
  children?: React.ReactNode;
  className?: string;
};

/** A block's header: its marker, name and controls, the one strip every named block takes. */
export function ContentHeader({
  icon,
  name,
  lang,
  meta,
  children,
  className,
}: ContentHeaderProps) {
  return (
    <div
      data-slot="content-header"
      // On touch as tall as a hit area, since the frame clips; its buttons'
      // own margins leave the room at its end. Under raymond a band of the
      // face along the top of the well.
      className={cn(
        "flex min-h-row items-center gap-2 border-b bg-muted py-0.5 pr-1 pl-2 text-ui-sm text-muted-foreground select-none touch:min-h-touch raymond:border-b-0 raymond:bg-(--3d-face)",
        className,
      )}
    >
      <ModuleMarker icon={icon} />
      {name !== undefined ? (
        <span className="min-w-0 truncate font-mono text-foreground">
          {name}
        </span>
      ) : (
        lang !== undefined &&
        lang !== "" && <span className="truncate font-mono">{lang}</span>
      )}
      {meta !== undefined && <span className="shrink-0">{meta}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {children}
      </span>
    </div>
  );
}
