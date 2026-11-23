import type { ComponentProps, ReactNode, Ref } from "react";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { EmptyState } from "./empty-state.tsx";

/**
 * `LoadFailure` occupies a surface that has nothing to display;
 * `RefreshFailure` sits above content retained after a transient refresh
 * failure. Both expose the raw error on the message and a retry for only the
 * failed read. A failure here does not recover by itself — unlike a
 * connection banner, which heals once the server is back — so the exit has to
 * be a control, not a promise.
 *
 * `size` scales the whole row — message and button together — because `xs`
 * exists for `text-ui-sm` surfaces sitting in 16px contexts, where an inherited
 * size would strand the message at body scale next to a proportioned button;
 * `sm` stays inheriting for body-scale surfaces. `className` merges last for
 * margins and one-off adjustments.
 *
 * `orientation` draws `LoadFailure` as an `EmptyState` in the destructive tone instead of the
 * line, for a failure that fills its pane (`vertical`) or stands for a section among others
 * (`horizontal`): `icon` for the place, `message` as its title and `detail` shown beneath it,
 * since a pane has the room a line lacks and a touch screen has no hover to show a `title`.
 * `size` applies to the line only; `EmptyState` sizes its own text per orientation.
 */
function FailureRow({
  message,
  detail,
  onRetry,
  retrying,
  retryRef,
  size,
  className,
  textClassName,
}: {
  message: ReactNode;
  detail: string | undefined;
  onRetry: () => void;
  retrying: boolean;
  retryRef?: Ref<HTMLButtonElement>;
  size: "sm" | "xs";
  className?: string;
  textClassName: string;
}) {
  return (
    <div
      role="status"
      // On touch the button's hit area leaves it no baseline to share.
      className={cn(
        textClassName,
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 touch:items-center",
        size === "xs" ? "text-ui-sm" : null,
        className,
      )}
    >
      <span title={detail}>{message}</span>
      <Button
        ref={retryRef}
        variant="outline"
        size={size}
        onClick={onRetry}
        disabled={retrying}
      >
        Retry
      </Button>
    </div>
  );
}
export function LoadFailure({
  message,
  detail,
  onRetry,
  retrying,
  retryRef,
  size = "sm",
  orientation,
  icon,
  className,
}: {
  message: ReactNode;
  detail: string | undefined;
  onRetry: () => void;
  retrying: boolean;
  /**
   * Retry is the only control a surface with nothing to display still offers,
   * which makes it the place focus has to go when an overlay opened from that
   * surface closes and its own opener is gone (T-430).
   */
  retryRef?: Ref<HTMLButtonElement>;
  size?: "sm" | "xs";
  orientation?: ComponentProps<typeof EmptyState>["orientation"];
  icon?: ComponentProps<typeof EmptyState>["icon"];
  className?: string;
}) {
  if (orientation) {
    return (
      <EmptyState
        role="status"
        orientation={orientation}
        tone="destructive"
        icon={icon}
        title={message}
        action={
          <Button
            ref={retryRef}
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            Retry
          </Button>
        }
        className={className}
      >
        {detail}
      </EmptyState>
    );
  }
  return (
    <FailureRow
      message={message}
      detail={detail}
      onRetry={onRetry}
      retrying={retrying}
      retryRef={retryRef}
      size={size}
      className={className}
      textClassName="text-destructive"
    />
  );
}

export function RefreshFailure({
  what,
  detail,
  onRetry,
  retrying,
  size = "sm",
  className,
}: {
  what: string;
  detail: string | undefined;
  onRetry: () => void;
  retrying: boolean;
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <FailureRow
      message={`Couldn't refresh ${what} (${detail}) — showing saved data.`}
      detail={detail}
      onRetry={onRetry}
      retrying={retrying}
      size={size}
      className={className}
      textClassName="text-warning"
    />
  );
}
