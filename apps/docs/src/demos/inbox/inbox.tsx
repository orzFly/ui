import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { RefreshFailure } from "@orz/ui/components/load-failure";
import { LoadMoreFooter } from "@orz/ui/components/load-more";
import { QueryBox } from "@orz/ui/components/query-box";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@orz/ui/components/sheet";
import { TooltipProvider } from "@orz/ui/components/tooltip";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import { useVisualViewportInsets } from "@orz/ui/hooks/viewport-chrome";
import { cn } from "@orz/ui/lib/utils";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import {
  ArchiveIcon,
  InboxIcon,
  MailIcon,
  MailOpenIcon,
  PanelLeftIcon,
  RefreshCwIcon,
  SearchIcon,
  SquarePenIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Compose } from "./compose.tsx";
import {
  ActionButton,
  type KeyAction,
  KeysDialog,
  useMailKeys,
} from "./keys.tsx";
import {
  closeThread,
  openThread,
  showQuery,
  threadHref,
  useOpenThread,
  useQuery,
} from "./location.ts";
import {
  changeThreads,
  checkMail,
  DEFAULT_QUERY,
  type Draft,
  draftCount,
  draftOf,
  EMPTY_STATE,
  fetchThreads,
  fileDraft,
  findThread,
  folderOf,
  hasWords,
  INBOX_ME,
  type InboxThread,
  type MailboxState,
  newDraft,
  type Page,
  PROVIDERS,
  SCHEMA,
  searchThreads,
  type ThreadChange,
  unreadIn,
} from "./mailbox.ts";
import { isPlainClick, PLACES, Rail, Sidebar } from "./sidebar.tsx";
import { type ComposerHandle, nameOf, Thread } from "./thread.tsx";

// Fenced code in a message is drawn through the content registry.
const RENDERERS = [codeContent];

const DAY = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** How long a finger rests on a row before it selects instead of opening. */
const LONG_PRESS_MS = 450;

/** The last message's opening words, its markdown punctuation dropped. */
function snippet(thread: InboxThread): string {
  const body = thread.messages.at(-1)?.body ?? "";
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*(?:[-*+>#]+|\d+\.)\s+/gm, "")
    .replace(/[*_`|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** Who wrote in a thread, in order, each once; a draft names who it is going to. */
function senders(thread: InboxThread): string {
  if (folderOf(thread) === "drafts" || folderOf(thread) === "sent") {
    const to = thread.messages.at(-1)?.to ?? [];
    return to.length ? `To: ${to.map(nameOf).join(", ")}` : "(no recipient)";
  }
  return [...new Set(thread.messages.map((message) => message.from))]
    .map(nameOf)
    .join(", ");
}

/** A search as it was submitted: the query, and the mailbox as it stood then. */
interface Search {
  query: string;
  state: MailboxState;
  /** Counts submissions, so the same query asked again starts over. */
  n: number;
}

function ThreadRow({
  thread,
  open,
  selected,
  selecting,
  onSelect,
  onOpen,
}: {
  thread: InboxThread;
  open: boolean;
  selected: boolean;
  /** Something is selected: on a touch screen a tap now selects too. */
  selecting: boolean;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
}) {
  const last = thread.messages.at(-1);
  const draft = folderOf(thread) === "drafts";
  const press = useRef<{ timer: number; fired: boolean; touch: boolean }>({
    timer: 0,
    fired: false,
    touch: false,
  });
  const cancelPress = () => clearTimeout(press.current.timer);
  const onPointerDown = (event: ReactPointerEvent) => {
    const touch = event.pointerType === "touch";
    press.current = { timer: 0, fired: false, touch };
    if (!touch) return;
    press.current.timer = window.setTimeout(() => {
      press.current.fired = true;
      onSelect(!selected);
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };
  return (
    <li
      data-thread={thread.id}
      className={cn(
        "group relative flex items-stretch transition-colors hover:bg-accent/60",
        (open || selected) && "bg-accent",
      )}
    >
      <span className="flex items-center pl-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(on) => onSelect(on === true)}
          aria-label={`Select “${thread.subject}”`}
        />
      </span>
      <a
        href={threadHref(thread.id)}
        aria-current={open ? "true" : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => {
          if (press.current.touch) event.preventDefault();
        }}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          if (press.current.fired) return;
          if (selecting && press.current.touch) onSelect(!selected);
          else onOpen();
        }}
        className="grid min-w-0 flex-1 select-none grid-cols-[0.5rem_1fr_auto] items-baseline gap-x-2 gap-y-0.5 px-3 py-2.5 outline-none [-webkit-touch-callout:none] focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset touch:py-3.5"
      >
        {/* The dot carries the state for sight; the hidden word for a screen reader. */}
        <span
          aria-hidden
          className={cn(
            "size-2 self-center rounded-full",
            thread.unread && "bg-primary",
          )}
        />
        <span
          className={cn(
            "truncate text-sm",
            thread.unread ? "font-semibold" : "text-muted-foreground",
          )}
        >
          {thread.unread && <span className="sr-only">Unread: </span>}
          {draft && (
            <span className="mr-1 font-medium text-foreground">Draft</span>
          )}
          {senders(thread)}
          {thread.messages.length > 1 && (
            <span className="ml-1 font-normal text-muted-foreground text-xs">
              {thread.messages.length}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
          {thread.starred && (
            <StarIcon aria-label="Starred" className="size-3 fill-current" />
          )}
          {last && (
            <time dateTime={last.at}>{DAY.format(new Date(last.at))}</time>
          )}
        </span>
        <span
          className={cn(
            "col-span-2 col-start-2 truncate text-sm",
            thread.unread && "font-medium",
          )}
        >
          {thread.subject}
        </span>
        <span className="col-span-2 col-start-2 line-clamp-2 text-muted-foreground text-xs md:line-clamp-1">
          {thread.labels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="mr-1 h-4 gap-1 px-1 align-[1px] text-[0.65rem]"
            >
              {label}
            </Badge>
          ))}
          {snippet(thread)}
        </span>
      </a>
    </li>
  );
}

/** What the list's toolbar does to the selection. */
interface BulkActions {
  onArchive: (ids: string[]) => void;
  onTrash: (ids: string[]) => void;
  onRestore: (ids: string[]) => void;
  onRead: (ids: string[], unread: boolean) => void;
  /** Asks before it deletes what is already in the Trash, which cannot be undone. */
  onDeleteForever: (ids: string[]) => void;
}

/** A check for new mail, as the list's toolbar shows it. */
interface Refresh {
  pending: boolean;
  /** Why the last check failed; the list stays as it was meanwhile. */
  error: string | undefined;
}

function ThreadList({
  search,
  state,
  open,
  selected,
  onSelected,
  onSearch,
  refresh,
  onRefresh,
  onCompose,
  onOpen,
  onMenu,
  bulk,
  visible,
  scrollRef,
}: {
  search: Search;
  state: MailboxState;
  open: string | null;
  selected: ReadonlySet<string>;
  onSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
  onSearch: (query: string) => void;
  refresh: Refresh;
  onRefresh: () => void;
  onCompose: () => void;
  onOpen: (thread: InboxThread) => void;
  onMenu: () => void;
  bulk: BulkActions;
  /** Filled with the ids on screen, in order, for the keys that walk them. */
  visible: RefObject<string[]>;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [value, setValue] = useState(search.query);
  useEffect(() => setValue(search.query), [search.query]);
  // Every page is read against the mailbox as it was when the search ran: a thread read since
  // stays where it was under `is:unread`, and the next page starts where the last one ended.
  const first = useMemo(
    () => searchThreads(search.query, search.state),
    [search],
  );
  const paged = usePagedAppend<Page>(String(search.n));
  const pages = [first, ...paged.pages];
  const next = pages.at(-1)?.next ?? null;
  const focusRequested = useRef(false);
  const loadMore = () => {
    if (next === null) return;
    focusRequested.current = true;
    paged.append(() => fetchThreads(search.query, search.state, next));
  };
  const threads = pages
    .flatMap((page) => page.ids)
    .map((id) => {
      const then = findThread(id, search.state);
      const now = findThread(id, state);
      // One archived, deleted or moved back since leaves the list at once, as in any mail
      // client; one only read stays until the next search.
      if (!then || !now || now.gone || folderOf(then) !== folderOf(now)) {
        return undefined;
      }
      return now;
    })
    .filter((thread) => thread !== undefined);
  visible.current = threads.map((thread) => thread.id);

  const shown = threads.filter((thread) => selected.has(thread.id));
  const all = threads.length > 0 && shown.length === threads.length;
  const ids = shown.map((thread) => thread.id);
  const folders = new Set(shown.map(folderOf));
  const allTrash = folders.size === 1 && folders.has("trash");
  const anyUnread = shown.some((thread) => thread.unread);
  const place = PLACES.find((each) => each.query === search.query);

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
        <ActionButton label="Folders" className="md:hidden" onClick={onMenu}>
          <PanelLeftIcon />
        </ActionButton>
        <QueryBox
          schema={SCHEMA}
          providers={PROVIDERS}
          value={value}
          onValueChange={setValue}
          onSubmit={(query) => onSearch(query)}
          renderSubmitRow={(query, option) => (
            <div {...option}>
              <SearchIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">Search for “{query}”</span>
            </div>
          )}
          listAlign="start"
          leading={<SearchIcon />}
          inputProps={{
            "aria-label": "Search mail",
            placeholder: "Search, or try is:unread…",
          }}
          className="min-w-0 flex-1"
        />
        {search.query !== DEFAULT_QUERY && (
          <ActionButton
            label="Clear search"
            onClick={() => onSearch(DEFAULT_QUERY)}
          >
            <XIcon />
          </ActionButton>
        )}
      </div>
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-b px-1.5 text-sm touch:h-13">
        <span className="flex size-8 items-center justify-center">
          <Checkbox
            checked={all ? true : shown.length > 0 ? "indeterminate" : false}
            onCheckedChange={() =>
              onSelected(
                new Set(all || shown.length > 0 ? [] : visible.current),
              )
            }
            aria-label={all || shown.length > 0 ? "Select none" : "Select all"}
          />
        </span>
        {shown.length > 0 ? (
          <>
            <span className="px-1 tabular-nums">{shown.length} selected</span>
            {folders.has("archive") || folders.has("trash") ? (
              <ActionButton
                label="Move to Inbox"
                onClick={() => bulk.onRestore(ids)}
              >
                <InboxIcon />
              </ActionButton>
            ) : (
              <ActionButton
                label="Archive"
                action="archive"
                onClick={() => bulk.onArchive(ids)}
              >
                <ArchiveIcon />
              </ActionButton>
            )}
            {!folders.has("trash") && (
              <ActionButton
                label="Delete"
                action="trash"
                onClick={() => bulk.onTrash(ids)}
              >
                <Trash2Icon />
              </ActionButton>
            )}
            <ActionButton
              label={anyUnread ? "Mark as read" : "Mark as unread"}
              action={anyUnread ? "read" : "unread"}
              onClick={() => bulk.onRead(ids, !anyUnread)}
            >
              {anyUnread ? <MailOpenIcon /> : <MailIcon />}
            </ActionButton>
            {allTrash && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => bulk.onDeleteForever(ids)}
              >
                Delete forever…
              </Button>
            )}
          </>
        ) : (
          <>
            <ActionButton
              label="Refresh"
              disabled={refresh.pending}
              onClick={onRefresh}
            >
              <RefreshCwIcon
                className={refresh.pending ? "animate-spin" : undefined}
              />
            </ActionButton>
            <span className="min-w-0 flex-1 truncate px-1 font-medium">
              {place?.title ?? "Search results"}
            </span>
            <span className="px-2 text-muted-foreground text-xs tabular-nums">
              {threads.length} of {first.total}
            </span>
          </>
        )}
      </div>
      {refresh.error && (
        <RefreshFailure
          what="the mail"
          detail={refresh.error}
          retrying={refresh.pending}
          onRetry={onRefresh}
          className="border-b px-3 py-2"
        />
      )}
      {/* Room under the last row for the phone's Compose button. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto max-md:pb-20"
      >
        {threads.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
            <InboxIcon className="size-8 text-muted-foreground" aria-hidden />
            {place ? (
              <>
                <p className="font-medium">Nothing in {place.title}</p>
                <p className="text-muted-foreground text-sm">{place.empty}</p>
                {(place.query === "in:sent" || place.query === "in:drafts") && (
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={onCompose}
                  >
                    <SquarePenIcon />
                    Compose
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">No conversations match</p>
                <p className="text-muted-foreground text-sm">
                  Nothing matches{" "}
                  <code className="font-mono">{search.query}</code>. Try fewer
                  words, or another filter.
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => onSearch(DEFAULT_QUERY)}
                >
                  Clear search
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul aria-label="Conversations" className="divide-y">
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                open={thread.id === open}
                selected={selected.has(thread.id)}
                selecting={shown.length > 0}
                onSelect={(on) =>
                  onSelected((was) => {
                    const next = new Set(was);
                    if (on) next.add(thread.id);
                    else next.delete(thread.id);
                    return next;
                  })
                }
                onOpen={() => onOpen(thread)}
              />
            ))}
          </ul>
        )}
        {(next !== null || paged.error) && (
          <div className="border-t p-3">
            <LoadMoreFooter
              pending={paged.pending}
              error={paged.error}
              onLoadMore={loadMore}
              focusRequested={focusRequested}
            />
          </div>
        )}
      </div>
    </>
  );
}

/** The verb a toast uses for a move into `folder`. */
const MOVED: Record<string, string> = {
  archive: "archived",
  trash: "moved to Trash",
  inbox: "moved to Inbox",
};

const conversations = (n: number) =>
  n === 1 ? "Conversation" : `${n} conversations`;

/**
 * A mail client: folders and labels in a sidebar, the conversations under a search box that
 * takes filters, and the open one beside them, with a compose window docked over the corner.
 * The sidebar folds to a rail where the screen is narrower; below `md` one pane shows at a time,
 * the folders slide in from the left, and a conversation or a new message takes the whole app.
 *
 * It fills the box it is given: the page lays the box out, the app only fills it.
 */
export function Inbox() {
  // Once, at the app's root: the reply box rides `--vv-bottom`.
  useVisualViewportInsets();
  const open = useOpenThread();
  const query = useQuery();
  const [state, setState] = useState<MailboxState>(EMPTY_STATE);
  const [search, setSearch] = useState<Search>({
    query,
    state: EMPTY_STATE,
    n: 0,
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [keys, setKeys] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refresh, setRefresh] = useState<Refresh>({
    pending: false,
    error: undefined,
  });
  const [deleting, setDeleting] = useState<string[]>([]);
  // Kept apart from `deleting` so the dialog keeps its title while it fades out.
  const [confirming, setConfirming] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const visible = useRef<string[]>([]);
  const listScroll = useRef<HTMLDivElement>(null);
  const threadScroll = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);

  const rerun = (q: string) => {
    setSelected(new Set());
    setSearch(({ n }) => ({ query: q, state: stateRef.current, n: n + 1 }));
  };
  // The URL leads: a folder picked, a search submitted, or Back, all land here.
  useEffect(() => {
    if (query !== search.query) rerun(query);
  });
  const onSearch = (q: string) => {
    if (q === search.query) rerun(q);
    else showQuery(q);
    setMenu(false);
  };

  const thread = open === null ? undefined : findThread(open, state);

  useEffect(() => {
    if (open === null || !findThread(open, stateRef.current)?.unread) return;
    setState((was) => changeThreads(was, [open], { unread: false })[0]);
  }, [open]);

  // On a phone the list is hidden while a thread is open, and a hidden box forgets its scroll.
  const listScrollTop = useRef(0);
  const shownThread = useRef(open);
  useLayoutEffect(() => {
    const was = shownThread.current;
    shownThread.current = open;
    if (was === open) return;
    threadScroll.current?.scrollTo(0, 0);
    if (open === null && listScroll.current) {
      listScroll.current.scrollTop = listScrollTop.current;
    }
  }, [open]);
  const openRow = (row: InboxThread) => {
    if (folderOf(row) === "drafts") {
      setDraft(draftOf(row));
      return;
    }
    listScrollTop.current = listScroll.current?.scrollTop ?? 0;
    openThread(row.id);
  };

  /** Applies `patch`, and says so in a toast whose Undo takes back exactly that. */
  const act = (ids: string[], patch: ThreadChange, message: string) => {
    if (ids.length === 0) return;
    const [next, undo] = changeThreads(stateRef.current, ids, patch);
    setState(next);
    setSelected(new Set());
    toast(message, {
      action: { label: "Undo", onClick: () => setState(undo) },
    });
  };
  const move = (ids: string[], folder: "archive" | "trash" | "inbox") => {
    if (open !== null && ids.includes(open)) closeThread();
    act(ids, { folder }, `${conversations(ids.length)} ${MOVED[folder]}`);
  };
  const markRead = (ids: string[], unread: boolean) => {
    if (unread && open !== null && ids.includes(open)) closeThread();
    act(
      ids,
      { unread },
      `${conversations(ids.length)} marked as ${unread ? "unread" : "read"}`,
    );
  };
  const askDeleteForever = (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleting(ids);
    setConfirming(true);
  };
  const deleteForever = () => {
    if (open !== null && deleting.includes(open)) closeThread();
    setState((was) => changeThreads(was, deleting, { gone: true })[0]);
    setSelected(new Set());
    setConfirming(false);
    toast(`${conversations(deleting.length)} deleted forever`);
  };
  const checkForMail = () => {
    setRefresh((was) => ({ ...was, pending: true }));
    checkMail().then(
      () => {
        setRefresh({ pending: false, error: undefined });
        rerun(search.query);
      },
      (error: Error) => setRefresh({ pending: false, error: error.message }),
    );
  };
  const star = (id: string) => {
    const was = findThread(id, stateRef.current);
    if (!was) return;
    setState((s) => changeThreads(s, [id], { starred: !was.starred })[0]);
  };

  const bulk: BulkActions = {
    onArchive: (ids) => move(ids, "archive"),
    onTrash: (ids) => move(ids, "trash"),
    onRestore: (ids) => move(ids, "inbox"),
    onRead: markRead,
    onDeleteForever: askDeleteForever,
  };

  const reply = (body: string) => {
    if (open === null) return;
    setState((was) => ({
      ...was,
      replies: {
        ...was.replies,
        [open]: [
          ...(was.replies[open] ?? []),
          { from: INBOX_ME, at: new Date().toISOString(), body },
        ],
      },
    }));
    // After the commit that adds it: the new message lands above the reply box. A scroll of
    // the script's own is not covered by the stylesheet's reduced motion, so it asks first.
    requestAnimationFrame(() => {
      const pane = threadScroll.current;
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      pane?.scrollTo({
        top: pane.scrollHeight,
        behavior: still ? "auto" : "smooth",
      });
    });
  };

  const compose = (from?: Draft) => {
    setMenu(false);
    setDraft(from ?? newDraft());
  };
  // A list showing drafts or sent mail has to be asked again to show what just went there.
  const refile = (next: MailboxState) => {
    stateRef.current = next;
    setState(next);
    rerun(search.query);
  };
  const closeCompose = (closing: Draft) => {
    setDraft(null);
    if (!hasWords(closing)) return;
    const before = stateRef.current;
    refile(fileDraft(before, closing, "drafts"));
    toast("Saved to Drafts", {
      action: {
        label: "Undo",
        onClick: () => {
          refile(before);
          setDraft(closing);
        },
      },
    });
  };
  const discard = (closing: Draft) => {
    setDraft(null);
    const before = stateRef.current;
    if (!findThread(closing.id, before)) {
      if (!hasWords(closing)) return;
      toast("Message discarded", {
        action: { label: "Undo", onClick: () => setDraft(closing) },
      });
      return;
    }
    refile(changeThreads(before, [closing.id], { gone: true })[0]);
    toast("Draft discarded", {
      action: { label: "Undo", onClick: () => refile(before) },
    });
  };
  const send = (sending: Draft) => {
    setDraft(null);
    const before = stateRef.current;
    refile(fileDraft(before, sending, "sent"));
    toast("Message sent", {
      action: {
        label: "Undo",
        onClick: () => {
          refile(before);
          setDraft(sending);
        },
      },
    });
  };
  const forward = () => {
    if (!thread) return;
    const last = thread.messages.at(-1);
    setDraft({
      ...newDraft(),
      subject: `Fwd: ${thread.subject}`,
      body: last
        ? `\n\n> From ${nameOf(last.from)}:\n>\n${last.body.replace(/^/gm, "> ")}`
        : "",
    });
  };
  const copyLink = () => {
    if (open === null) return;
    navigator.clipboard
      ?.writeText(new URL(threadHref(open), location.href).href)
      .then(
        () => toast("Link copied"),
        () => toast.error("Couldn't copy the link"),
      );
  };

  /** What a key acts on: the open thread, else the selection, else the focused row. */
  const targets = (): string[] => {
    if (open !== null) return [open];
    if (selected.size > 0) return [...selected];
    const row = document.activeElement?.closest<HTMLElement>("[data-thread]");
    return row?.dataset.thread ? [row.dataset.thread] : [];
  };
  const focusRow = (id: string) =>
    document
      .querySelector<HTMLElement>(`[data-thread="${CSS.escape(id)}"] a`)
      ?.focus();
  const step = (by: 1 | -1) => {
    const ids = visible.current;
    const at = open ?? targets()[0];
    const i = at === undefined ? -1 : ids.indexOf(at);
    const to = ids[Math.max(0, Math.min(ids.length - 1, i + by))];
    if (to === undefined) return;
    if (open !== null) openThread(to);
    else focusRow(to);
  };
  useMailKeys((action: KeyAction) => {
    if (draft !== null && action !== "help") return;
    const ids = targets();
    const one = ids[0] === undefined ? undefined : findThread(ids[0], state);
    switch (action) {
      case "next":
        return step(1);
      case "previous":
        return step(-1);
      case "open":
        if (one && open === null) openRow(one);
        return;
      case "back":
        if (open !== null) closeThread();
        return;
      case "select":
        if (one && open === null) {
          const next = new Set(selected);
          if (next.has(one.id)) next.delete(one.id);
          else next.add(one.id);
          setSelected(next);
        }
        return;
      case "archive":
        return move(ids, "archive");
      case "trash":
        if (one && folderOf(one) === "trash") return askDeleteForever(ids);
        return move(ids, "trash");
      case "star":
        if (one) star(one.id);
        return;
      case "unread":
        return markRead(ids, true);
      case "read":
        return markRead(ids, false);
      case "compose":
        return compose();
      case "reply":
        composer.current?.focus();
        return;
      case "help":
        setKeys(true);
    }
  });

  const counts: Record<string, number> = {
    "in:inbox": unreadIn("inbox", state),
    "in:drafts": draftCount(state),
  };
  const side = {
    query: search.query,
    counts,
    onShow: onSearch,
    onCompose: () => compose(),
    onKeys: () => {
      setMenu(false);
      setKeys(true);
    },
  };

  return (
    <TooltipProvider>
      <ContentRenderers renderers={RENDERERS}>
        {/* Capped at a screen, so in a box with no height of its own the panes still scroll. */}
        <div className="relative flex h-full max-h-dvh min-h-0 overflow-hidden bg-background text-foreground">
          <aside
            aria-label="Mail"
            data-width="wide"
            className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground max-xl:hidden"
          >
            <Sidebar {...side} />
          </aside>
          <aside
            aria-label="Mail"
            className="w-14 shrink-0 border-r bg-sidebar text-sidebar-foreground max-md:hidden xl:hidden"
          >
            <Rail {...side} />
          </aside>
          <section
            aria-label="Mail list"
            className={cn(
              "flex min-w-0 flex-col max-md:flex-1 md:w-80 md:shrink-0 md:border-r lg:w-96",
              thread && "max-md:hidden",
            )}
          >
            <ThreadList
              search={search}
              state={state}
              open={open}
              selected={selected}
              onSelected={setSelected}
              onSearch={onSearch}
              refresh={refresh}
              onRefresh={checkForMail}
              onCompose={() => compose()}
              onOpen={openRow}
              onMenu={() => setMenu(true)}
              bulk={bulk}
              visible={visible}
              scrollRef={listScroll}
            />
            {/* The phone's Compose sits under the thumb; a wide screen's is in the sidebar. */}
            <Button
              size="lg"
              onClick={() => compose()}
              className="absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 rounded-2xl shadow-lg md:hidden"
            >
              <SquarePenIcon />
              Compose
            </Button>
          </section>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              !thread && "max-md:hidden",
            )}
          >
            {thread ? (
              <Thread
                thread={thread}
                onSend={reply}
                composerRef={composer}
                scrollRef={threadScroll}
                actions={{
                  onBack: closeThread,
                  onArchive: () => move([thread.id], "archive"),
                  onTrash: () => move([thread.id], "trash"),
                  onRestore: () => move([thread.id], "inbox"),
                  onDeleteForever: () => askDeleteForever([thread.id]),
                  onUnread: () => markRead([thread.id], true),
                  onStar: () => star(thread.id),
                  onLabel: (label, on) =>
                    setState(
                      (s) =>
                        changeThreads(s, [thread.id], {
                          labels: on
                            ? [...thread.labels, label]
                            : thread.labels.filter((each) => each !== label),
                        })[0],
                    ),
                  onForward: forward,
                  onCopyLink: copyLink,
                }}
              />
            ) : (
              <div className="grid flex-1 place-content-center justify-items-center gap-2 p-8 text-center text-muted-foreground">
                <InboxIcon className="size-8" aria-hidden />
                <p>Pick a conversation to read it.</p>
              </div>
            )}
          </div>
          {draft && (
            <Compose
              key={draft.id}
              draft={draft}
              onClose={closeCompose}
              onDiscard={discard}
              onSend={send}
            />
          )}
        </div>
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetTitle className="sr-only">Folders</SheetTitle>
            <SheetDescription className="sr-only">
              Mail's folders and labels
            </SheetDescription>
            <Sidebar {...side} />
          </SheetContent>
        </Sheet>
        <KeysDialog open={keys} onOpenChange={setKeys} />
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={
            deleting.length === 1
              ? `Delete “${findThread(deleting[0] ?? "", state)?.subject}” forever?`
              : `Delete ${deleting.length} conversations forever?`
          }
          description={
            deleting.length === 1
              ? "It cannot be restored. To keep it, move it back to the inbox instead."
              : "They cannot be restored. To keep them, move them back to the inbox instead."
          }
          confirmLabel={
            deleting.length === 1
              ? "Delete forever"
              : `Delete ${deleting.length} conversations`
          }
          destructive
          onConfirm={deleteForever}
        />
      </ContentRenderers>
    </TooltipProvider>
  );
}
