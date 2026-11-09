import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a table holds, which decides how it is set. `data` holds rows of records, one line each,
 * that a reader scans, points at and picks. `prose` holds sentences laid out in columns, a docs
 * page's comparison: its cells wrap, sit at the top of their row, and take the size of the prose
 * around them, and its rows take no hover.
 */
type TablePurpose = "data" | "prose";

function Table({
  purpose = "data",
  className,
  ...props
}: React.ComponentProps<"table"> & { purpose?: TablePurpose }) {
  return (
    <div
      data-slot="table-container"
      // Under raymond a table is a list box, sunken on the window colour.
      className="relative w-full overflow-x-auto raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken"
    >
      <table
        data-slot="table"
        data-purpose={purpose}
        className={cn(
          "group/table w-full caption-bottom",
          purpose === "prose" ? "border-collapse text-prose-sm" : "text-ui-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Its row is not one to point at, so it takes no hover.
      className={cn("[&_tr]:border-b [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      // Prose keeps the rule under its last row.
      className={cn(
        "[&_tr:last-child]:border-0 group-data-[purpose=prose]/table:[&_tr:last-child]:border-b raymond:group-data-[purpose=prose]/table:[&_tr:last-child]:border-b-transparent",
        className,
      )}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // The current row (aria-current, the one whose details are shown)
        // takes the selection's fill without its cue. Under raymond rows
        // carry no rules and no hover, and only the highlight is filled: the
        // current row, or a selected one with no checkbox, since a ticked
        // box is its own mark. Everything in the highlight, its quiet text,
        // outlined chips and primary dots included, takes the highlight's
        // text colour, as Windows draws it.
        "border-b transition-colors hover:bg-muted/50 group-data-[purpose=prose]/table:hover:bg-transparent has-aria-expanded:bg-muted/50 aria-[current=true]:bg-accent aria-[current=true]:hover:bg-accent data-[state=selected]:bg-accent data-[state=selected]:text-accent-foreground data-[state=selected]:*:first:state-cue raymond:border-b-transparent raymond:[&:not([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:bg-transparent raymond:[&:not([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:hover:bg-transparent raymond:[&:not([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:has-aria-expanded:bg-transparent raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:text-primary-foreground raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:[--accent:var(--primary)] raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:[--border:var(--primary-foreground)] raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:[--foreground:var(--primary-foreground)] raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:[--muted-foreground:var(--primary-foreground)] raymond:[&:is([aria-current=true],[data-state=selected]:not(:has([role=checkbox])))]:*:[--primary:var(--primary-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Under raymond a column header is a raised button in regular weight.
        "h-row-head bg-muted px-2 text-left align-middle font-semibold whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 raymond:font-normal raymond:shadow-raised",
        "group-data-[purpose=prose]/table:h-auto group-data-[purpose=prose]/table:bg-transparent group-data-[purpose=prose]/table:px-3 group-data-[purpose=prose]/table:py-2 group-data-[purpose=prose]/table:font-medium group-data-[purpose=prose]/table:whitespace-normal group-data-[purpose=prose]/table:text-muted-foreground raymond:group-data-[purpose=prose]/table:bg-(--3d-face) raymond:group-data-[purpose=prose]/table:py-0.5 raymond:group-data-[purpose=prose]/table:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        // Under raymond a row is as tight as what it holds.
        "h-row px-2 py-1 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 raymond:py-0",
        "group-data-[purpose=prose]/table:h-auto group-data-[purpose=prose]/table:px-3 group-data-[purpose=prose]/table:py-2 group-data-[purpose=prose]/table:align-top group-data-[purpose=prose]/table:whitespace-normal raymond:group-data-[purpose=prose]/table:py-1",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-2 text-ui-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  type TablePurpose,
  TableRow,
};
