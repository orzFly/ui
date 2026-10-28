import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { Button } from "@orz/ui/components/button";
import { Skeleton } from "@orz/ui/components/skeleton";
import { cn } from "@orz/ui/lib/utils";
import { EditorShortcutsHelp } from "@orz/ui-codemirror/components/editor-shortcuts-help";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { attachmentLinks, Markdown, markdownEmbeds } from "@orz/ui-markdown";
import { mermaidContent } from "@orz/ui-mermaid";
import { ArrowLeftIcon } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { ClientOnly } from "../../hydrated.tsx";
import { noteCompletions } from "./completions.ts";
import { type ListedNote, NoteList } from "./note-list.tsx";
import {
  matches,
  NOTES,
  resolveFile,
  tagCounts,
  titleOf,
  wordCount,
} from "./notebook.ts";

// A mermaid fence is a diagram before it is code; files a note embeds or links go to the rest.
const RENDERERS = [mermaidContent, ...ATTACHMENT_RENDERERS];
const PLUGINS = [
  markdownEmbeds({ resolve: resolveFile }),
  attachmentLinks({ resolve: resolveFile }),
];

/** What a wide screen shows of the open note. */
type Mode = "edit" | "split" | "preview";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "edit", label: "Edit" },
  { mode: "split", label: "Split" },
  { mode: "preview", label: "Preview" },
];

const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** A segmented switch: one pressed button per choice, as the theme menu's light/dark switch. */
function Segmented<T extends string>({
  label,
  options,
  pressed,
  onPress,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  pressed: T;
  onPress: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className={cn("grid grid-flow-col rounded-md bg-muted p-0.5", className)}
    >
      {options.map(({ value, label: text }) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === pressed}
          onClick={() => onPress(value)}
          className="relative rounded-sm px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs touch:hit-area"
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mx-auto grid max-w-prose gap-3">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-3 h-40 w-full" />
    </div>
  );
}

/** Where the screen is. On a phone `open` says whether the note is pushed over the list. */
interface View {
  id: string;
  open: boolean;
}

let created = 0;

/**
 * A notebook: notes in folders, filtered by words and `#tags`, each written in markdown beside its
 * rendered preview. `/` at the start of a line offers blocks — diagrams among them — and `#` the
 * tags already in use. Below `md` the list and the note take turns, as the inbox's do; below `lg`
 * there is room for the editor or the preview, not both.
 */
export function Notes() {
  const [notes, setNotes] = useState<ListedNote[]>(() =>
    NOTES.map((note) => ({ ...note })),
  );
  const [view, setView] = useState<View>({
    id: NOTES[0]?.id ?? "",
    open: false,
  });
  const [mode, setMode] = useState<Mode>("split");
  // A phone opens a note to read it, and writes only when asked to.
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);

  // Typing updates the editor at once; the list, the tags and the preview follow when React has
  // time, so a long note or a diagram never holds up a keystroke.
  const settled = useDeferredValue(notes);
  const tags = useMemo(
    () => tagCounts(settled.map((note) => note.body)),
    [settled],
  );
  const tagsNow = useRef(tags);
  tagsNow.current = tags;
  // Built once: MarkdownEditor reconfigures whenever it gets a new extension.
  const extensions = useMemo(() => noteCompletions(() => tagsNow.current), []);

  // A tag no note carries any more has no chip to turn it off with.
  const active = new Set(
    [...chosen].filter((tag) => tags.some(([t]) => t === tag)),
  );
  const shown = settled.filter((note) => matches(note.body, query, active));
  const note = notes.find(({ id }) => id === view.id) ?? notes[0];
  const preview = settled.find(({ id }) => id === note?.id)?.body ?? "";

  const open = (id: string) => {
    setView({ id, open: true });
    setPhoneEditing(false);
    setFresh(null);
  };

  const create = () => {
    created += 1;
    const id = `new-${created}`;
    setNotes((list) => [
      ...list,
      {
        id,
        folder: note?.folder ?? "Journal",
        updated: new Date().toISOString(),
        body: "",
      },
    ]);
    setQuery("");
    setChosen(new Set());
    setView({ id, open: true });
    setPhoneEditing(true);
    setMode((was) => (was === "preview" ? "split" : was));
    setFresh(id);
  };

  const edit = (id: string, body: string) =>
    setNotes((list) =>
      list.map((each) =>
        each.id === id
          ? { ...each, body, updated: new Date().toISOString() }
          : each,
      ),
    );

  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <div className="flex h-full overflow-hidden">
          <nav
            aria-label="Notebook"
            className={cn(
              "flex min-w-0 flex-1 flex-col md:w-72 md:flex-none md:border-r",
              view.open && "max-md:hidden",
            )}
          >
            <NoteList
              notes={shown}
              selected={view.id}
              query={query}
              onQuery={setQuery}
              tags={tags}
              chosen={active}
              onToggleTag={(tag) =>
                setChosen((was) => {
                  const next = new Set(was);
                  if (!next.delete(tag)) next.add(tag);
                  return next;
                })
              }
              onClear={() => {
                setQuery("");
                setChosen(new Set());
              }}
              onOpen={open}
              onNew={create}
            />
          </nav>
          {note && (
            <article
              aria-labelledby="note-title"
              className={cn(
                "flex min-w-0 flex-1 flex-col",
                !view.open && "max-md:hidden",
              )}
            >
              <header className="flex shrink-0 items-center gap-2 border-b px-2 py-2 md:px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Back to notes"
                  onClick={() => setView((was) => ({ ...was, open: false }))}
                >
                  <ArrowLeftIcon />
                </Button>
                <div className="min-w-0 flex-1">
                  <h2
                    id="note-title"
                    className="truncate font-semibold leading-snug"
                  >
                    {titleOf(note.body)}
                  </h2>
                  <p className="truncate text-muted-foreground text-xs">
                    {note.folder} · Edited{" "}
                    <time dateTime={note.updated}>
                      {STAMP.format(new Date(note.updated))} UTC
                    </time>
                  </p>
                </div>
                <Segmented
                  label="View"
                  options={MODES.map(({ mode: value, label }) => ({
                    value,
                    label,
                  }))}
                  pressed={mode}
                  onPress={setMode}
                  className="max-lg:hidden"
                />
                <Segmented
                  label="View"
                  options={[
                    { value: "edit", label: "Edit" },
                    { value: "preview", label: "Preview" },
                  ]}
                  pressed={phoneEditing ? "edit" : "preview"}
                  onPress={(value) => setPhoneEditing(value === "edit")}
                  className="lg:hidden"
                />
                <div
                  className={cn(
                    mode === "preview" && "lg:hidden",
                    !phoneEditing && "max-lg:hidden",
                  )}
                >
                  <EditorShortcutsHelp />
                </div>
              </header>
              <div className="flex min-h-0 flex-1">
                <section
                  aria-label="Markdown"
                  className={cn(
                    "flex min-w-0 flex-1 flex-col",
                    mode === "preview" && "lg:hidden",
                    !phoneEditing && "max-lg:hidden",
                    mode === "split" && "lg:border-r",
                  )}
                >
                  <MarkdownEditor
                    key={note.id}
                    initialValue={note.body}
                    ariaLabel="Note"
                    placeholder="Start with a # heading. Type / at the start of a line for a block."
                    autoFocus={fresh === note.id}
                    onChange={(body) => edit(note.id, body)}
                    extensions={extensions}
                    className="h-full min-h-0 rounded-none border-0 px-2 py-2 focus-within:ring-0 md:px-3 dark:bg-transparent"
                  />
                </section>
                <section
                  aria-label="Preview"
                  className={cn(
                    "min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6",
                    mode === "edit" && "lg:hidden",
                    phoneEditing && "max-lg:hidden",
                  )}
                >
                  {preview.trim() === "" ? (
                    <p className="text-muted-foreground text-sm">
                      Nothing to preview yet.
                    </p>
                  ) : (
                    // A file a note links or embeds is addressed by a blob: URL, which the
                    // prerender cannot mint the same as the browser.
                    <ClientOnly fallback={<PreviewSkeleton />}>
                      <Markdown
                        plugins={PLUGINS}
                        className="mx-auto max-w-prose"
                      >
                        {preview}
                      </Markdown>
                    </ClientOnly>
                  )}
                </section>
              </div>
              <footer className="shrink-0 border-t px-4 py-1.5 text-muted-foreground text-xs">
                {wordCount(note.body)} words · Kept in this tab only
              </footer>
            </article>
          )}
        </div>
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}
