import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tabs,
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
    <Tabs defaultValue="loading">
      <TabsList>
        <TabsTrigger value="loading">Loading</TabsTrigger>
        <TabsTrigger value="empty">Empty</TabsTrigger>
        <TabsTrigger value="failed">Failed</TabsTrigger>
        <TabsTrigger value="loaded">Loaded</TabsTrigger>
      </TabsList>
      <div className="mt-2 min-h-36 rounded-lg border p-4">
        <TabsContent value="loading" className="grid gap-4">
          {[0, 1].map((row) => (
            <div key={row} className="grid gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          ))}
        </TabsContent>
        <TabsContent
          value="empty"
          className="grid justify-items-center gap-2 py-2 text-center"
        >
          <FileTextIcon className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nothing in Drafts</p>
          <p className="text-muted-foreground text-sm">
            A message you close without sending waits here.
          </p>
          <Button variant="outline" className="mt-1">
            <SquarePenIcon data-icon="inline-start" /> Compose
          </Button>
        </TabsContent>
        <TabsContent value="failed">
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
        <TabsContent value="loaded">
          <ul className="grid gap-4">
            {DRAFTS.map((draft) => (
              <li key={draft.id} className="grid gap-0.5">
                <span className="text-muted-foreground text-xs">
                  <span className="font-medium text-foreground">Draft</span> To:{" "}
                  {draft.messages
                    .at(-1)
                    ?.to?.map((login) => INBOX_PEOPLE[login] ?? login)
                    .join(", ")}
                </span>
                <span className="truncate text-sm">{draft.subject}</span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </div>
    </Tabs>
  );
}
