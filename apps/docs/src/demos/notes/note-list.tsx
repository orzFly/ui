import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { cn } from "@orz/ui/lib/utils";
import { NotebookIcon, PlusIcon, SearchIcon } from "lucide-react";
import { NOTE_FOLDERS, snippetOf, titleOf } from "./notebook.ts";

/** UTC, so the prerender and every reader's browser print the same day. */
const DAY = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A note as the list shows it: the text as it stands, and when it last changed. */
export interface ListedNote {
  id: string;
  folder: string;
  updated: string;
  body: string;
}

function NoteRow({
  note,
  selected,
  onOpen,
}: {
  note: ListedNote;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
        className={cn(
          "grid w-full grid-cols-[1fr_auto] items-baseline gap-x-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent touch:min-h-11",
          selected && "bg-accent",
        )}
      >
        <span className="truncate font-medium text-sm">
          {titleOf(note.body)}
        </span>
        <time
          dateTime={note.updated}
          className="text-muted-foreground text-xs tabular-nums"
        >
          {DAY.format(new Date(note.updated))}
        </time>
        <span className="col-span-2 line-clamp-2 text-muted-foreground text-xs md:line-clamp-1">
          {snippetOf(note.body)}
        </span>
      </button>
    </li>
  );
}

/**
 * The notebook's left column: a filter over the notes, the tags to narrow them by, and the notes
 * themselves under their folders, the latest change first.
 */
export function NoteList({
  notes,
  selected,
  query,
  onQuery,
  tags,
  chosen,
  onToggleTag,
  onClear,
  onOpen,
  onNew,
}: {
  /** Already filtered. */
  notes: readonly ListedNote[];
  selected: string;
  query: string;
  onQuery: (query: string) => void;
  /** Every tag in the notebook with its count. */
  tags: readonly [string, number][];
  chosen: ReadonlySet<string>;
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const filtered = query !== "" || chosen.size > 0;
  return (
    <>
      <div className="grid shrink-0 gap-2 border-b p-2">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 px-1 font-semibold">Notes</h2>
          <Button size="sm" variant="outline" onClick={onNew}>
            <PlusIcon />
            New note
          </Button>
        </div>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Filter notes"
            placeholder="Filter notes"
            enterKeyHint="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="pl-8"
          />
        </div>
        {tags.length > 0 && (
          <fieldset aria-label="Tags" className="flex min-w-0 flex-wrap gap-1">
            {tags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                aria-pressed={chosen.has(tag)}
                onClick={() => onToggleTag(tag)}
                className="relative inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground touch:hit-area"
              >
                #{tag}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {notes.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-10 text-center">
            <NotebookIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">No notes match</p>
            <p className="text-muted-foreground text-sm">
              Try fewer words, or fewer tags.
            </p>
            {filtered && (
              <Button variant="outline" size="sm" onClick={onClear}>
                Clear filter
              </Button>
            )}
          </div>
        ) : (
          NOTE_FOLDERS.map((folder) => {
            const inFolder = notes
              .filter((note) => note.folder === folder)
              .sort((a, b) => b.updated.localeCompare(a.updated));
            if (inFolder.length === 0) return null;
            return (
              <section
                key={folder}
                aria-labelledby={`notes-folder-${folder}`}
                className="mb-3"
              >
                <h3
                  id={`notes-folder-${folder}`}
                  className="px-2.5 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  {folder}
                </h3>
                <ul className="grid gap-0.5">
                  {inFolder.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      selected={note.id === selected}
                      onOpen={() => onOpen(note.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
