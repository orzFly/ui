import { NOTES } from "@orz/fixtures/notes.ts";
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
import { NotebookIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

const titleOf = (body: string) => /^# (.+)$/m.exec(body)?.[1] ?? "Untitled";

const SHOWN = NOTES.slice(0, 4);

export function ListStates() {
  const [state, setState] = useState("loading");
  const [retrying, setRetrying] = useState(false);
  return (
    <Tabs variant="framed" value={state} onValueChange={setState}>
      <TabsBar>
        <TabsList>
          <TabsTrigger value="loading">Loading</TabsTrigger>
          <TabsTrigger value="empty">Empty</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="loaded">Loaded</TabsTrigger>
        </TabsList>
      </TabsBar>
      <TabsContent value="loading" className="min-h-56 p-2">
        <List purpose="listbox">
          <ul aria-label="Loading notes" className="grid gap-0.5">
            {SHOWN.map((note) => (
              <ListItem key={note.id} asChild>
                <li className="grid min-h-row gap-1.5 px-2.5 py-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </TabsContent>
      <TabsContent value="empty" className="min-h-56 px-6 py-10">
        <EmptyState
          icon={NotebookIcon}
          title="No notes yet"
          action={
            <Button variant="outline" size="sm">
              <PlusIcon />
              New note
            </Button>
          }
        >
          A note is markdown, kept in this tab. Start one with a # heading.
        </EmptyState>
      </TabsContent>
      <TabsContent value="failed" className="min-h-56 p-4.5">
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
      <TabsContent value="loaded" className="min-h-56 p-2">
        <List purpose="listbox">
          <ul aria-label="Notes" className="grid gap-0.5">
            {SHOWN.map((note) => (
              <ListItem key={note.id} asChild>
                <li className="grid min-h-row gap-0.5 px-2.5 py-2">
                  <span className="font-medium text-ui">
                    {titleOf(note.body)}
                  </span>
                  <span className="text-muted-foreground text-ui-sm">
                    {note.folder}
                  </span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </TabsContent>
    </Tabs>
  );
}
