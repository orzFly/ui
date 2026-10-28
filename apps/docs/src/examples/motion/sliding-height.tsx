import { NOTES } from "@orz/fixtures/notes.ts";
import { cn } from "@orz/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

const TITLES = NOTES.filter((note) => note.folder === "Projects").map(
  (note) => /^# (.*)$/m.exec(note.body)?.[1] ?? note.id,
);

export function SlidingHeight() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-1 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-accent"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-700",
            open && "rotate-90",
          )}
        />
        Projects
      </button>
      <ul
        inert={!open}
        className={cn(
          "grid gap-1 overflow-hidden pl-8 transition-[height] duration-700 ease-in-out",
          open ? "h-20" : "h-0",
        )}
      >
        {TITLES.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </div>
  );
}
