import {
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { RefreshFailure } from "@orz/ui/components/load-failure";
import { LoadMoreFooter } from "@orz/ui/components/load-more";
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
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <div className="flex h-11 items-center gap-1 border-b px-1.5 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh"
                disabled={refreshing}
                onClick={refresh}
              >
                <RefreshCwIcon
                  className={
                    refreshing ? "motion-safe:animate-spin" : undefined
                  }
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <span className="flex-1 font-medium">Inbox</span>
          <span className="px-2 text-muted-foreground text-xs tabular-nums">
            {threads.length} of {INBOX.length}
          </span>
        </div>
        {stale && (
          <RefreshFailure
            what="the inbox"
            detail="503 Service Unavailable"
            retrying={refreshing}
            onRetry={refresh}
            className="border-b px-3 py-2"
          />
        )}
        <ul aria-label="Conversations" className="divide-y">
          {threads.map((thread) => (
            <li key={thread.id} className="grid gap-0.5 px-3 py-2.5">
              <span className="truncate font-medium text-sm">
                {INBOX_PEOPLE[thread.messages[0]?.from ?? ""]}
              </span>
              <span className="truncate text-muted-foreground text-sm">
                {thread.subject}
              </span>
            </li>
          ))}
        </ul>
        {threads.length < INBOX.length && (
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
    </TooltipProvider>
  );
}
