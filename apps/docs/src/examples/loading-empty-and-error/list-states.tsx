import { NOTES } from "@orz/fixtures/notes.ts";
import { Button } from "@orz/ui/components/button";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { NotebookIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

const titleOf = (body: string) => /^# (.+)$/m.exec(body)?.[1] ?? "Untitled";

const SHOWN = NOTES.slice(0, 4);

export function ListStates() {
  const [state, setState] = useState("loading");
  const [retrying, setRetrying] = useState(false);
  return (
    <Tabs value={state} onValueChange={setState}>
      <TabsList>
        <TabsTrigger value="loading">Loading</TabsTrigger>
        <TabsTrigger value="empty">Empty</TabsTrigger>
        <TabsTrigger value="failed">Failed</TabsTrigger>
        <TabsTrigger value="loaded">Loaded</TabsTrigger>
      </TabsList>
      <div className="mt-2 min-h-56 rounded-lg border p-2">
        <TabsContent value="loading">
          <ul aria-label="Loading notes" className="grid gap-0.5">
            {SHOWN.map((note) => (
              <li key={note.id} className="grid gap-1.5 px-2.5 py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent
          value="empty"
          className="grid justify-items-center gap-2 px-4 py-8 text-center"
        >
          <NotebookIcon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No notes yet</p>
          <p className="text-muted-foreground text-ui">
            A note is markdown, kept in this tab. Start one with a # heading.
          </p>
          <Button variant="outline" size="sm" className="mt-1">
            <PlusIcon />
            New note
          </Button>
        </TabsContent>
        <TabsContent value="failed" className="p-2.5">
          <LoadFailure
            message="Couldn't load your notes."
            detail="503 Service Unavailable"
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => {
                setRetrying(false);
                setState("loaded");
              }, 800);
            }}
          />
        </TabsContent>
        <TabsContent value="loaded">
          <ul aria-label="Notes" className="grid gap-0.5">
            {SHOWN.map((note) => (
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
        </TabsContent>
      </div>
    </Tabs>
  );
}
