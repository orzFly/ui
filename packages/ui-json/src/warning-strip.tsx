import { ToolbarButton } from "@orz/ui/components/toolbar";
import { cn } from "@orz/ui/lib/utils";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A line across the view that says what it could not show: the warning colour on its own tint,
 * raymond's info tip yellow under raymond.
 */
export function WarningStrip({
  children,
  action,
  dismiss,
  onDismiss,
  className,
}: {
  children: ReactNode;
  /** A button that acts on what it says, such as Retry, before the dismiss button. */
  action?: ReactNode;
  /** The dismiss button's name; without `onDismiss` there is none. */
  dismiss?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      data-slot="json-warning"
      className={cn(
        "flex flex-none items-start gap-2 border-b border-warning/40 bg-warning/8 py-0.5 pr-1 pl-2 text-ui-sm text-warning raymond:border-(--3d-shadow) raymond:bg-(--info) raymond:text-(--info-foreground)",
        !onDismiss && !action && "py-1 pr-2",
        className,
      )}
    >
      <span className="flex-1 self-center">{children}</span>
      {action}
      {onDismiss && (
        <ToolbarButton
          size="icon-xs"
          aria-label={dismiss}
          title={dismiss}
          // On touch it keeps the rest of the touch spacing above and below
          // too: the strip sits right under the toolbar's search field.
          className="text-inherit touch:my-hit-xs"
          onClick={onDismiss}
        >
          <XIcon />
        </ToolbarButton>
      )}
    </div>
  );
}
