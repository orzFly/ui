import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      // Under raymond a table is a list box, sunken on the window colour.
      className="relative w-full overflow-x-auto raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-ui-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
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
        // Under raymond rows carry no rules, and everything in a selected
        // row, its quiet text and outlined chips included, takes the
        // highlight's text colour, as Windows draws it.
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-accent data-[state=selected]:*:first:state-cue raymond:border-b-transparent raymond:data-[state=selected]:text-primary-foreground raymond:data-[state=selected]:[--accent:var(--primary)] raymond:data-[state=selected]:[--border:var(--primary-foreground)] raymond:data-[state=selected]:[--foreground:var(--primary-foreground)] raymond:data-[state=selected]:[--muted-foreground:var(--primary-foreground)]",
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
        // Under raymond a column header is a raised button.
        "h-row-head bg-muted px-2 text-left align-middle font-semibold whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 raymond:shadow-raised",
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
        "h-row px-2 py-1 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
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
  TableRow,
};
