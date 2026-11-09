import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { EmptyState } from "@orz/ui/components/empty-state";
import { List, ListItem } from "@orz/ui/components/list";
import { Separator } from "@orz/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { ArchiveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Folder = "inbox" | "archive" | "trash" | "gone";

const THREADS = INBOX_THREADS.filter(({ folder }) => folder === undefined)
  .slice(0, 4)
  .map(({ id, subject }) => ({ id, subject, folder: "inbox" as Folder }));

const MOVED = { archive: "archived", trash: "moved to Trash" };

const conversations = (n: number) =>
  n === 1 ? "Conversation" : `${n} conversations`;

export function DeleteWithUndo() {
  const [threads, setThreads] = useState(THREADS);
  const [confirming, setConfirming] = useState(false);
  // Kept apart from `confirming` so the dialog keeps its title while it fades out.
  const [deleting, setDeleting] = useState<typeof THREADS>([]);
  const fileAs = (id: string, folder: Folder) =>
    setThreads((list) =>
      list.map((thread) => (thread.id === id ? { ...thread, folder } : thread)),
    );
  const move = (id: string, to: "archive" | "trash") => {
    fileAs(id, to);
    toast(`Conversation ${MOVED[to]}`, {
      action: { label: "Undo", onClick: () => fileAs(id, "inbox") },
    });
  };
  const inbox = threads.filter(({ folder }) => folder === "inbox");
  const trash = threads.filter(({ folder }) => folder === "trash");
  const one = deleting.length === 1;
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <List purpose="collection">
          {inbox.length > 0 ? (
            <ul>
              {inbox.map(({ id, subject }) => (
                <ListItem key={id} asChild>
                  <li className="flex min-h-row items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-ui">
                      {subject}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Archive “${subject}”`}
                          onClick={() => move(id, "archive")}
                        >
                          <ArchiveIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete “${subject}”`}
                          onClick={() => move(id, "trash")}
                        >
                          <Trash2Icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </li>
                </ListItem>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing in Inbox" className="py-2">
              New mail lands here. Archive what you have dealt with.
            </EmptyState>
          )}
        </List>
        <Separator />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-muted-foreground text-ui">
            Trash:{" "}
            {trash.length === 0
              ? "empty"
              : conversations(trash.length).toLowerCase()}
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={trash.length === 0}
            onClick={() => {
              setDeleting(trash);
              setConfirming(true);
            }}
          >
            Delete forever…
          </Button>
        </div>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={
            one
              ? `Delete “${deleting[0]?.subject}” forever?`
              : `Delete ${deleting.length} conversations forever?`
          }
          description={
            one
              ? "It cannot be restored. To keep it, move it back to the inbox instead."
              : "They cannot be restored. To keep them, move them back to the inbox instead."
          }
          confirmLabel={
            one ? "Delete forever" : `Delete ${deleting.length} conversations`
          }
          destructive
          onConfirm={() => {
            setThreads((list) =>
              list.map((thread) =>
                deleting.some(({ id }) => id === thread.id)
                  ? { ...thread, folder: "gone" }
                  : thread,
              ),
            );
            setConfirming(false);
            // Their Undo would bring back conversations that no longer exist.
            toast.dismiss();
            toast(`${conversations(deleting.length)} deleted forever`);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
