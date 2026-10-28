import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Textarea } from "@orz/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  ArchiveIcon,
  EllipsisIcon,
  ForwardIcon,
  LinkIcon,
  MailIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTIONS = [
  { label: "Archive", Icon: ArchiveIcon },
  { label: "Delete", Icon: Trash2Icon },
  { label: "Mark as unread", Icon: MailIcon },
];

export function ThreadToolbar() {
  const [reply, setReply] = useState("");
  return (
    <TooltipProvider>
      <div className="grid gap-3 rounded-lg border">
        <div className="flex items-center gap-0.5 border-b p-1">
          {ACTIONS.map(({ label, Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={label}>
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <form
          aria-label="Reply"
          className="flex items-end gap-2 px-3 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            setReply("");
          }}
        >
          <Textarea
            aria-label="Reply"
            placeholder="Reply in markdown…"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            className="min-h-10 flex-1"
          />
          <Button type="submit" disabled={reply.trim() === ""}>
            <SendIcon data-icon="inline-start" />
            Send
          </Button>
        </form>
      </div>
    </TooltipProvider>
  );
}
