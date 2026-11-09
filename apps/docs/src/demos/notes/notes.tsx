import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Pane } from "@orz/ui/components/pane";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { Skeleton } from "@orz/ui/components/skeleton";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import { EditorShortcutsHelp } from "@orz/ui-codemirror/components/editor-shortcuts-help";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { attachmentLinks, Markdown, markdownEmbeds } from "@orz/ui-markdown";
import { mermaidContent } from "@orz/ui-mermaid";
import {
  ArrowLeftIcon,
  EllipsisIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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

  // Nothing is asked first: the note comes back from the toast, where it was.
  const remove = (id: string) => {
    const at = notes.findIndex((each) => each.id === id);
    const gone = notes[at];
    if (!gone) return;
    const rest = notes.filter((each) => each.id !== id);
    setNotes(rest);
    setView({ id: rest[Math.min(at, rest.length - 1)]?.id ?? "", open: false });
    toast(`Deleted “${titleOf(gone.body)}”`, {
      action: {
        label: "Undo",
        onClick: () => {
          setNotes((list) => [...list.slice(0, at), gone, ...list.slice(at)]);
          setView({ id, open: true });
        },
      },
    });
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
    <TooltipProvider>
      <ContentRenderers renderers={RENDERERS}>
        <AttachmentViewerProvider>
          <Pane purpose="app" className="flex h-full overflow-hidden">
            <Pane purpose="panel" edge={{ md: "end" }} asChild>
              <nav
                aria-label="Notebook"
                className={cn(
                  "flex min-w-0 flex-1 flex-col md:w-72 md:flex-none",
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
            </Pane>
            {note && (
              <Pane purpose="panel" asChild>
                <article
                  aria-labelledby="note-title"
                  className={cn(
                    "flex min-w-0 flex-1 flex-col",
                    !view.open && "max-md:hidden",
                  )}
                >
                  <Pane purpose="toolbar" edge="bottom" asChild>
                    <header className="flex shrink-0 items-center gap-2 px-2 py-2 md:px-4">
                      <ToolbarButton
                        className="md:hidden"
                        aria-label="Back to notes"
                        onClick={() =>
                          setView((was) => ({ ...was, open: false }))
                        }
                      >
                        <ArrowLeftIcon />
                      </ToolbarButton>
                      <div className="min-w-0 flex-1">
                        <h2
                          id="note-title"
                          className="truncate font-semibold leading-snug"
                        >
                          {titleOf(note.body)}
                        </h2>
                        <p className="truncate text-muted-foreground text-ui-sm">
                          {note.folder} · Edited{" "}
                          <time dateTime={note.updated}>
                            {STAMP.format(new Date(note.updated))} UTC
                          </time>
                        </p>
                      </div>
                      <SegmentedControl
                        aria-label="View"
                        value={mode}
                        onValueChange={(value) => setMode(value as Mode)}
                        className="max-lg:hidden"
                      >
                        {MODES.map(({ mode: value, label }) => (
                          <SegmentedControlItem key={value} value={value}>
                            {label}
                          </SegmentedControlItem>
                        ))}
                      </SegmentedControl>
                      <SegmentedControl
                        aria-label="View"
                        value={phoneEditing ? "edit" : "preview"}
                        onValueChange={(value) =>
                          setPhoneEditing(value === "edit")
                        }
                        className="lg:hidden"
                      >
                        <SegmentedControlItem value="edit">
                          Edit
                        </SegmentedControlItem>
                        <SegmentedControlItem value="preview">
                          Preview
                        </SegmentedControlItem>
                      </SegmentedControl>
                      <div
                        className={cn(
                          mode === "preview" && "lg:hidden",
                          !phoneEditing && "max-lg:hidden",
                        )}
                      >
                        <EditorShortcutsHelp />
                      </div>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <ToolbarButton aria-label="More actions">
                                <EllipsisIcon />
                              </ToolbarButton>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>More actions</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={create}>
                            <PlusIcon />
                            New note
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => remove(note.id)}
                          >
                            <Trash2Icon />
                            Delete note
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>
                  </Pane>
                  <div className="flex min-h-0 flex-1">
                    <Pane
                      purpose="panel"
                      edge={mode === "split" ? { lg: "end" } : "none"}
                      asChild
                    >
                      <section
                        aria-label="Markdown"
                        className={cn(
                          "flex min-w-0 flex-1 flex-col",
                          mode === "preview" && "lg:hidden",
                          !phoneEditing && "max-lg:hidden",
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
                          purpose="document"
                          className="h-full min-h-0 px-2 py-2 md:px-3"
                        />
                      </section>
                    </Pane>
                    <Pane purpose="document" asChild>
                      <section
                        aria-label="Preview"
                        className={cn(
                          "flex min-w-0 flex-1 flex-col",
                          mode === "edit" && "lg:hidden",
                          phoneEditing && "max-lg:hidden",
                        )}
                      >
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
                          {preview.trim() === "" ? (
                            <p className="text-muted-foreground text-ui">
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
                        </div>
                      </section>
                    </Pane>
                  </div>
                  <Pane purpose="statusbar" asChild>
                    <footer className="shrink-0 px-4 py-1.5">
                      {wordCount(note.body)} words · Kept in this tab only
                    </footer>
                  </Pane>
                </article>
              </Pane>
            )}
          </Pane>
        </AttachmentViewerProvider>
      </ContentRenderers>
    </TooltipProvider>
  );
}
