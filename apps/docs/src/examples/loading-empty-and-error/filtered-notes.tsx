import { NOTES } from "@orz/fixtures/notes.ts";
import { Button } from "@orz/ui/components/button";
import { NotebookIcon } from "lucide-react";
import { useState } from "react";

const TAGS = ["ci", "design", "fetch", "release"];

const titleOf = (body: string) => /^# (.+)$/m.exec(body)?.[1] ?? "Untitled";
const hasTag = (body: string, tag: string) =>
  new RegExp(`(^|\\s)#${tag}\\b`).test(body);

export function FilteredNotes() {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(["ci"]));
  const shown = NOTES.filter((note) =>
    [...chosen].every((tag) => hasTag(note.body, tag)),
  );
  const toggle = (tag: string) =>
    setChosen((was) => {
      const next = new Set(was);
      if (!next.delete(tag)) next.add(tag);
      return next;
    });
  return (
    <div className="grid gap-3">
      <fieldset aria-label="Tags" className="flex flex-wrap gap-1">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={chosen.has(tag)}
            onClick={() => toggle(tag)}
            className="relative inline-flex h-6 items-center rounded-full border px-2 text-xs transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground touch:hit-area"
          >
            #{tag}
          </button>
        ))}
      </fieldset>
      <div className="min-h-44 rounded-lg border p-2">
        {shown.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-6 text-center">
            <NotebookIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">No notes match</p>
            <p className="text-muted-foreground text-sm">Try fewer tags.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChosen(new Set())}
            >
              Clear filter
            </Button>
          </div>
        ) : (
          <ul aria-label="Notes" className="grid gap-0.5">
            {shown.map((note) => (
              <li key={note.id} className="grid gap-0.5 px-2.5 py-2">
                <span className="font-medium text-sm">
                  {titleOf(note.body)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {note.folder}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
