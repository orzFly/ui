import { NOTES } from "@orz/fixtures/notes.ts";
import { Button } from "@orz/ui/components/button";
import { Toggle } from "@orz/ui/components/toggle";
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
          <Toggle
            key={tag}
            pressed={chosen.has(tag)}
            onPressedChange={() => toggle(tag)}
          >
            #{tag}
          </Toggle>
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
            <p className="text-muted-foreground text-ui">Try fewer tags.</p>
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
                <span className="font-medium text-ui">
                  {titleOf(note.body)}
                </span>
                <span className="text-muted-foreground text-ui-sm">
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
