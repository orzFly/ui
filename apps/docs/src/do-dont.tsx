import { cn } from "@orz/ui/lib/utils";
import { CheckIcon, type LucideIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A Do and a Don't side by side, stacked on a phone. */
export function DoDont({ children }: { children: ReactNode }) {
  return <div className="my-6 grid gap-4 md:grid-cols-2">{children}</div>;
}

/**
 * The verdict is a labelled marker, and its colour stays on the label, so a
 * page of pairs does not read as a page of alarms.
 */
function Verdict({
  label,
  Icon,
  tone,
  show,
  children,
}: {
  label: string;
  Icon: LucideIcon;
  tone: string;
  show?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="m-0 flex flex-col overflow-hidden rounded-surface border">
      {show !== undefined && (
        <div className="grid flex-1 content-center gap-3 p-5">{show}</div>
      )}
      <figcaption
        className={cn(
          "px-4 py-3 text-sm leading-6 [&>p]:my-0",
          show === undefined ? "flex-1" : "border-t",
        )}
      >
        <b className={cn("mb-1 flex items-center gap-1.5 font-semibold", tone)}>
          <span
            aria-hidden
            className="inline-grid size-4 shrink-0 place-items-center border border-current"
          >
            <Icon className="size-3 stroke-3" />
          </span>
          {label}
        </b>
        {children}
      </figcaption>
    </figure>
  );
}

/**
 * What to do. `show` is a live stage above the caption; without it the
 * caption stands alone, for a rule that is words only.
 */
export function Do(props: { show?: ReactNode; children: ReactNode }) {
  return <Verdict label="Do" Icon={CheckIcon} tone="text-success" {...props} />;
}

/** What not to do, and why; `show` as on `Do`. */
export function Dont(props: { show?: ReactNode; children: ReactNode }) {
  return (
    <Verdict label="Don't" Icon={XIcon} tone="text-destructive" {...props} />
  );
}
