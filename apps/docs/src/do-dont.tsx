import { cn } from "@orz/ui/lib/utils";
import type { ReactNode } from "react";

/** A Do and a Don't side by side, stacked on a phone. */
export function DoDont({ children }: { children: ReactNode }) {
  return <div className="my-6 grid gap-4 md:grid-cols-2">{children}</div>;
}

function Verdict({
  label,
  bar,
  show,
  children,
}: {
  label: string;
  bar: string;
  show?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="m-0 flex flex-col overflow-hidden rounded-xl border">
      {show !== undefined && (
        <div className="grid flex-1 content-center gap-3 p-5">{show}</div>
      )}
      <figcaption
        className={cn(
          "border-t-4 px-4 py-3 text-sm leading-6 [&>p]:my-0",
          show === undefined && "flex-1",
          bar,
        )}
      >
        <b className="block font-semibold">{label}</b>
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
  return (
    <Verdict
      label="Do"
      // --diff-addition, not --chart-*, because it is the token meant to read as "good".
      bar="border-t-(--diff-addition) [&>b]:text-(--diff-addition)"
      {...props}
    />
  );
}

/** What not to do, and why; `show` as on `Do`. */
export function Dont(props: { show?: ReactNode; children: ReactNode }) {
  return (
    <Verdict
      label="Don't"
      bar="border-t-destructive [&>b]:text-destructive"
      {...props}
    />
  );
}
