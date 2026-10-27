import { INBOX_ME } from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { LoadMoreFooter } from "@orz/ui/components/load-more";
import { QueryBox } from "@orz/ui/components/query-box";
import { revealBlock, useScrollInsets } from "@orz/ui/hooks/scroll-insets";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import { useVisualViewportInsets } from "@orz/ui/hooks/viewport-chrome";
import { cn } from "@orz/ui/lib/utils";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { InboxIcon, SearchIcon, StarIcon } from "lucide-react";
import {
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { hrefOf } from "../../routes.ts";
import {
  current,
  EMPTY_STATE,
  fetchThreads,
  type InboxThread,
  type MailboxState,
  type Page,
  PROVIDERS,
  SCHEMA,
  searchThreads,
  threadById,
} from "./mailbox.ts";
import { closeThread, openThread, useOpenThread } from "./open-thread.ts";
import { nameOf, Thread } from "./thread.tsx";

// Fenced code in a message is drawn through the content registry.
const RENDERERS = [codeContent];

const DAY = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

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

/** Who wrote in a thread, in order, each once. */
function senders(thread: InboxThread): string {
  return [...new Set(thread.messages.map((message) => message.from))]
    .map(nameOf)
    .join(", ");
}

// Absolute, so a prerendered link carries the base. Spelled out rather than read from the router,
// which would pull every page's meta into this demo's tests.
const PAGE = hrefOf("/demos/inbox/", import.meta.env.BASE_URL);

/** A plain click opens in place; a modified one is the browser's, a new tab say. */
const isPlainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

function ThreadRow({ thread, open }: { thread: InboxThread; open: boolean }) {
  const last = thread.messages.at(-1);
  return (
    <li>
      <a
        href={`${PAGE}?thread=${encodeURIComponent(thread.id)}`}
        aria-current={open ? "true" : undefined}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          openThread(thread.id);
        }}
        className={cn(
          "grid grid-cols-[0.5rem_1fr_auto] items-baseline gap-x-2 gap-y-0.5 px-3 py-3 transition-colors hover:bg-accent md:py-2.5 touch:py-3.5",
          open && "bg-accent",
        )}
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
              className="mr-1 h-4 px-1 align-[1px] text-[0.65rem]"
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

/** A search as it was submitted: the query, and the mailbox as it stood then. */
interface Search {
  query: string;
  state: MailboxState;
  /** Counts submissions, so the same query asked again starts over. */
  n: number;
}

function ThreadList({
  search,
  state,
  open,
  onSearch,
}: {
  search: Search;
  state: MailboxState;
  open: string | null;
  onSearch: (query: string) => void;
}) {
  const [value, setValue] = useState(search.query);
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
    .map((id) => threadById.get(id))
    .filter((thread) => thread !== undefined)
    .map((thread) => current(thread, state));

  return (
    <>
      <div className="sticky top-14 z-20 flex shrink-0 items-center gap-2 rounded-t-xl border-b bg-card/95 p-2 backdrop-blur md:static md:rounded-tr-none">
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
            placeholder: "Search, or is:unread from: label:",
          }}
          className="min-w-0 flex-1"
        />
        {search.query !== "" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue("");
              onSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {/* On a wide screen the list scrolls on its own, under a search box that stays put. */}
      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        {threads.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
            <InboxIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No conversations match</p>
            <p className="text-muted-foreground text-sm">
              Nothing matches <code className="font-mono">{search.query}</code>.
              Try fewer words, or another filter.
            </p>
          </div>
        ) : (
          <ul aria-label="Conversations" className="divide-y">
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                open={thread.id === open}
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

/** Where the list was scrolled when a thread replaced it on a phone. */
let listScrollY = 0;

/**
 * A mail client: the conversations with a search box over them, and the open conversation beside
 * them. Below `md` there is room for one at a time, so opening a conversation pushes it over the
 * list, and Back returns to the list where the reader left it.
 */
export function Inbox() {
  // Once, at the app's root: the reply box rides `--vv-bottom`.
  useVisualViewportInsets();
  const open = useOpenThread();
  const [state, setState] = useState<MailboxState>(EMPTY_STATE);
  const [search, setSearch] = useState<Search>({
    query: "",
    state: EMPTY_STATE,
    n: 0,
  });

  const siteHeader = useRef<HTMLElement | null>(null);
  const threadHeader = useRef<HTMLElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Before useScrollInsets' own layout effect, which measures it: the site's sticky header is the
  // page's first, and this demo does not own it.
  useLayoutEffect(() => {
    siteHeader.current = document.querySelector("header");
  }, []);
  // Every reveal lands below both headers and above the reply box.
  useScrollInsets({ top: [siteHeader, threadHeader], bottom: [composer] });

  const thread = open === null ? undefined : threadById.get(open);

  useEffect(() => {
    if (open === null || !threadById.get(open)?.unread) return;
    setState((was) =>
      was.read.has(open) ? was : { ...was, read: new Set(was.read).add(open) },
    );
  }, [open]);

  // A thread opens at its top, and the list comes back where it was left. Layout, so a phone
  // never paints the new view at the old one's scroll position.
  const shown = useRef(open);
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = open;
    if (was === open) return;
    if (open === null) {
      window.scrollTo(0, listScrollY);
      return;
    }
    if (was === null) listScrollY = window.scrollY;
    const top = root.current;
    if (top && top.getBoundingClientRect().top < 0) {
      revealBlock(top, { mode: "start", flash: false });
    }
  }, [open]);

  const send = (body: string) => {
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
    // After the commit that adds it: the new message lands above the reply box.
    requestAnimationFrame(() => {
      const last = document.querySelector<HTMLElement>(
        "[aria-labelledby=inbox-subject] ol > li:last-child",
      );
      if (last) revealBlock(last, { behavior: "smooth" });
    });
  };

  return (
    <ContentRenderers renderers={RENDERERS}>
      <div
        ref={root}
        className="rounded-xl border bg-card text-card-foreground md:grid md:grid-cols-[minmax(18rem,24rem)_1fr]"
      >
        <section
          aria-label="Inbox"
          className={cn(
            "min-w-0 md:sticky md:top-14 md:flex md:h-[calc(100dvh-3.5rem)] md:flex-col md:border-r",
            thread && "max-md:hidden",
          )}
        >
          <ThreadList
            search={search}
            state={state}
            open={open}
            onSearch={(query) =>
              setSearch(({ n }) => ({ query, state, n: n + 1 }))
            }
          />
        </section>
        <div
          className={cn(
            "flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col",
            !thread && "max-md:hidden",
          )}
        >
          {thread ? (
            <Thread
              thread={current(thread, state)}
              onBack={closeThread}
              onSend={send}
              headerRef={threadHeader}
              composerRef={composer}
            />
          ) : (
            <div className="grid flex-1 place-content-center justify-items-center gap-2 p-8 text-center text-muted-foreground">
              <InboxIcon className="size-8" aria-hidden />
              <p>Pick a conversation to read it.</p>
            </div>
          )}
        </div>
      </div>
    </ContentRenderers>
  );
}
