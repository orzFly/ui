import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  EllipsisIcon,
  ForwardIcon,
  LinkIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const thread = INBOX_THREADS.find(({ folder }) => folder === "trash");

export function TrashThreadMenu() {
  const [confirming, setConfirming] = useState(false);
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Move to Inbox">
                <Undo2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to Inbox</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    aria-label="More actions"
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <ForwardIcon />
                Forward
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast("Link copied")}>
                <LinkIcon />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirming(true)}
              >
                <Trash2Icon />
                Delete forever…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h3 className="font-semibold">{thread?.subject}</h3>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${thread?.subject}” forever?`}
        description="It cannot be restored. To keep it, move it back to the inbox instead."
        confirmLabel="Delete forever"
        destructive
        onConfirm={() => {
          setConfirming(false);
          toast("Conversation deleted forever");
        }}
      />
    </TooltipProvider>
  );
}
