import { ToolbarButton } from "@orz/ui/components/toolbar";
import { cn } from "@orz/ui/lib/utils";
import { DownloadIcon, Maximize2Icon } from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { ContentTitleBar } from "../title-bar.tsx";
import type { ContentSource } from "../types.ts";
import { ContentCollapse, ContentCollapseBody } from "./content-collapse.tsx";
import { ContentFrame, ContentHeader } from "./content-frame.tsx";
import { fileIcon } from "./icon.ts";

export type DocumentCardProps = {
  name: string;
  /** Default: `fileIcon({ name })`. */
  icon?: ComponentType<{ className?: string }>;
  /** Short muted note next to the name (e.g. a size). */
  meta?: ReactNode;
  /** Extra header controls, rendered before download/expand. */
  headerActions?: ReactNode;
  /**
   * The source the body draws, when its renderer may put controls in the header
   * (`useContentTitleBar`). They sit after the name, before `headerActions`.
   */
  titleBarFor?: ContentSource;
  downloadUrl?: string;
  /** Opens the full document; without it the card draws no expand controls. */
  onExpand?: () => void;
  className?: string;
  children: ReactNode;
};

const BUTTON = "text-muted-foreground raymond:text-foreground";

/**
 * A bordered card with a filename header and a body cut at the shared cap, whose bar opens
 * `onExpand` (the viewer) or, without it, shows the rest in place. Generic on purpose: an
 * attachment embed puts the drawn file in it, and an app can put anything else there, with
 * version chips or review state in `headerActions`.
 *
 * The body keeps a padding around what it holds, except around a renderer whose root carries
 * `data-content-flush`, a view that fills the frame edge to edge.
 */
export function DocumentCard({
  name,
  icon,
  meta,
  headerActions,
  titleBarFor,
  downloadUrl,
  onExpand,
  className,
  children,
}: DocumentCardProps) {
  const [titleBar, setTitleBar] = useState<HTMLElement | null>(null);
  const Icon = icon ?? fileIcon({ name });

  return (
    <ContentFrame className={cn("my-2", className)}>
      <ContentCollapse collapse="measure" onOpen={onExpand}>
        <ContentHeader
          icon={<Icon />}
          name={
            onExpand ? (
              <button
                type="button"
                onClick={onExpand}
                className="max-w-full cursor-pointer truncate text-left hover:underline"
              >
                {name}
              </button>
            ) : (
              name
            )
          }
          meta={meta}
        >
          {titleBarFor !== undefined && (
            <span ref={setTitleBar} className="contents" />
          )}
          {headerActions}
          {downloadUrl !== undefined && (
            <ToolbarButton asChild size="icon-xs" className={BUTTON}>
              <a
                href={downloadUrl}
                download={name}
                aria-label={`download ${name}`}
              >
                <DownloadIcon />
              </a>
            </ToolbarButton>
          )}
          {onExpand && (
            <ToolbarButton
              type="button"
              size="icon-xs"
              onClick={onExpand}
              aria-label={`expand ${name}`}
              className={BUTTON}
            >
              <Maximize2Icon />
            </ToolbarButton>
          )}
        </ContentHeader>
        <ContentCollapseBody>
          <div className="p-3 has-[>[data-content-flush]]:p-0">
            {titleBarFor === undefined ? (
              children
            ) : (
              <ContentTitleBar source={titleBarFor} target={titleBar}>
                {children}
              </ContentTitleBar>
            )}
          </div>
        </ContentCollapseBody>
      </ContentCollapse>
    </ContentFrame>
  );
}
