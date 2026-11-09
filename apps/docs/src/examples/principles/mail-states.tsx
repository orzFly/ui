import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import { List, ListItem } from "@orz/ui/components/list";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tabs,
  TabsBar,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { FileTextIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";

const DRAFTS = INBOX_THREADS.filter((thread) => thread.folder === "drafts");

export function MailStates() {
  const [retrying, setRetrying] = useState(false);
  return (
    <Tabs variant="framed" defaultValue="loading">
      <TabsBar>
        <TabsList>
          <TabsTrigger value="loading">Loading</TabsTrigger>
          <TabsTrigger value="empty">Empty</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="loaded">Loaded</TabsTrigger>
        </TabsList>
      </TabsBar>
      <TabsContent
        value="loading"
        className="grid min-h-36 content-start gap-4 p-4"
      >
        {[0, 1].map((row) => (
          <div key={row} className="grid gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        ))}
      </TabsContent>
      <TabsContent value="empty" className="min-h-36 px-4 py-6">
        <EmptyState
          icon={FileTextIcon}
          title="Nothing in Drafts"
          action={
            <Button variant="outline">
              <SquarePenIcon data-icon="inline-start" /> Compose
            </Button>
          }
        >
          A message you close without sending waits here.
        </EmptyState>
      </TabsContent>
      <TabsContent value="failed" className="min-h-36 p-4">
        <LoadFailure
          message="Couldn't load Drafts."
          detail="503 Service Unavailable"
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            setTimeout(() => setRetrying(false), 800);
          }}
        />
      </TabsContent>
      <TabsContent value="loaded" className="min-h-36 p-2">
        <List purpose="listbox">
          <ul aria-label="Drafts">
            {DRAFTS.map((draft) => (
              <ListItem key={draft.id} asChild>
                <li className="grid min-h-row gap-0.5 px-2.5 py-2">
                  <span className="text-muted-foreground text-ui-sm">
                    <span className="font-medium text-foreground">Draft</span>{" "}
                    To:{" "}
                    {draft.messages
                      .at(-1)
                      ?.to?.map((login) => INBOX_PEOPLE[login] ?? login)
                      .join(", ")}
                  </span>
                  <span className="truncate text-ui">{draft.subject}</span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </TabsContent>
    </Tabs>
  );
}
