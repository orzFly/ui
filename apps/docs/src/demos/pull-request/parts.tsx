import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Skeleton } from "@orz/ui/components/skeleton";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { ClientOnly } from "../../hydrated.tsx";
import type { CiJob } from "./run.ts";

/** UTC, so the prerender and every reader's browser print the same thing. */
const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function Stamp({ at }: { at: string }) {
  return (
    <time dateTime={at} className="tabular-nums">
      {STAMP.format(new Date(at))} UTC
    </time>
  );
}

export function UserAvatar({
  login,
  size = "sm",
}: {
  login: string;
  size?: "sm" | "default";
}) {
  return (
    <Avatar size={size} aria-hidden>
      <AvatarFallback>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function StatusIcon({ status }: { status: CiJob["status"] }) {
  return status === "failed" ? (
    <CircleXIcon
      aria-label="failed"
      className="size-4 shrink-0 text-destructive"
    />
  ) : (
    <CircleCheckIcon
      aria-label="passed"
      className="size-4 shrink-0 text-success"
    />
  );
}

// What a pane in "viewer" placement fills: a log, a patch.
export const PANE: CSSProperties & Record<`--${string}`, string> = {
  "--attachment-pane-height": "min(40rem, 75dvh)",
};

/** A pane drawn in the browser only: the renderers measure and fetch, which a prerender cannot. */
export function Pane({
  children,
  height = "h-(--attachment-pane-height)",
}: {
  children: () => ReactNode;
  /** The fallback's height, as a class. */
  height?: string;
}) {
  return (
    <ClientOnly fallback={<Skeleton className={`${height} w-full`} />}>
      {children()}
    </ClientOnly>
  );
}
