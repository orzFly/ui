import {
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { List, ListItem } from "@orz/ui/components/list";
import { RefreshFailure } from "@orz/ui/components/load-failure";
import { LoadMoreFooter } from "@orz/ui/components/load-more";
import { Pane } from "@orz/ui/components/pane";
import { Separator } from "@orz/ui/components/separator";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import { RefreshCwIcon } from "lucide-react";
import { useRef, useState } from "react";

const INBOX = INBOX_THREADS.filter(
  (thread) => (thread.folder ?? "inbox") === "inbox",
);
const PAGE = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function InboxList() {
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const refreshes = useRef(0);
  const paged = usePagedAppend<InboxThread[]>("inbox");
  const loads = useRef(0);
  const focusRequested = useRef(false);
  const threads = [INBOX.slice(0, PAGE), ...paged.pages].flat();

  const refresh = async () => {
    setRefreshing(true);
    await wait(600);
    refreshes.current += 1;
    setStale(refreshes.current === 1);
    setRefreshing(false);
  };
  const loadMore = () => {
    focusRequested.current = true;
    const from = threads.length;
    paged.append(async () => {
      await wait(600);
      loads.current += 1;
      if (loads.current === 2) throw new Error("the connection dropped");
      return INBOX.slice(from, from + PAGE);
    });
  };

  return (
    <TooltipProvider>
      <Pane purpose="panel" frame="card" className="min-w-0 overflow-hidden">
        <Pane
          purpose="toolbar"
          edge="bottom"
          className="flex items-center gap-1 px-1.5 py-1.5"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarButton
                aria-label="Refresh"
                disabled={refreshing}
                onClick={refresh}
              >
                <RefreshCwIcon
                  className={
                    refreshing ? "motion-safe:animate-spin" : undefined
                  }
                />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <span className="flex-1 font-medium text-ui">Inbox</span>
          <span className="px-2 text-muted-foreground text-ui-sm tabular-nums">
            {threads.length} of {INBOX.length}
          </span>
        </Pane>
        {stale && (
          <>
            <RefreshFailure
              what="the inbox"
              detail="503 Service Unavailable"
              retrying={refreshing}
              onRetry={refresh}
              className="px-3 py-2"
            />
            <Separator />
          </>
        )}
        <List purpose="listbox">
          <ul aria-label="Conversations">
            {threads.map((thread) => (
              <ListItem key={thread.id} asChild>
                <li className="grid min-h-row gap-0.5 px-3 py-2.5">
                  <span className="truncate font-medium text-ui">
                    {INBOX_PEOPLE[thread.messages[0]?.from ?? ""]}
                  </span>
                  <span className="truncate text-muted-foreground text-ui">
                    {thread.subject}
                  </span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
        {threads.length < INBOX.length && (
          <>
            <Separator />
            <div className="p-3">
              <LoadMoreFooter
                pending={paged.pending}
                error={paged.error}
                onLoadMore={loadMore}
                focusRequested={focusRequested}
              />
            </div>
          </>
        )}
      </Pane>
    </TooltipProvider>
  );
}
