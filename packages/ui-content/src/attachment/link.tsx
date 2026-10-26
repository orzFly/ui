import { isPlainLeftClick, LinkChip } from "@orz/ui/components/link-chip";
import { cn } from "@orz/ui/lib/utils";
import type { ReactNode } from "react";
import { fileIcon } from "./icon.ts";
import {
  type FileSource,
  useAttachmentViewer,
  useCanPreview,
  useViewHref,
} from "./viewer.tsx";

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
 * can draw opens the viewer instead. A deleted file is its name struck
 * through, and no link.
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

  if (file.deleted) {
    const Icon = fileIcon(file);
    return (
      <span
        className={cn(
          "font-medium text-muted-foreground line-through",
          className,
        )}
        title={`${file.name} (deleted)`}
        data-attachment-deleted=""
      >
        <Icon aria-hidden className="mr-0.5 inline size-3.5 align-middle" />
        {children ?? file.name}
      </span>
    );
  }
  return (
    <LinkChip
      href={href === "" ? undefined : href}
      // The label is the chip's truncating child, so a long filename is cut
      // where it used to wrap and stay whole.
      title={file.name}
      icon={fileIcon(file)}
      boxed={boxed}
      className={className}
      onClick={(e) => {
        if (viewer !== null && canPreview && isPlainLeftClick(e)) {
          e.preventDefault();
          viewer.show(file);
        }
      }}
    >
      {children ?? file.name}
    </LinkChip>
  );
}
