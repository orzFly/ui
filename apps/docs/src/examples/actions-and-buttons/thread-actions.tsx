import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
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
  InboxIcon,
  LinkIcon,
  type LucideIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

type Folder = "Inbox" | "Archive" | "Trash";

const ACTIONS: {
  label: string;
  key?: string;
  icon: LucideIcon;
  to: Folder;
  from: Folder[];
}[] = [
  {
    label: "Archive",
    key: "E",
    icon: ArchiveIcon,
    to: "Archive",
    from: ["Inbox"],
  },
  {
    label: "Move to Inbox",
    icon: InboxIcon,
    to: "Inbox",
    from: ["Archive", "Trash"],
  },
  {
    label: "Delete",
    key: "#",
    icon: Trash2Icon,
    to: "Trash",
    from: ["Inbox", "Archive"],
  },
];

const MOVED: Record<Folder, string> = {
  Inbox: "Conversation moved to Inbox",
  Archive: "Conversation archived",
  Trash: "Conversation moved to Trash",
};

export function ThreadActions() {
  const [folder, setFolder] = useState<Folder>("Inbox");
  const [reply, setReply] = useState("");
  const move = (to: Folder) => {
    const was = folder;
    setFolder(to);
    toast(MOVED[to], {
      action: { label: "Undo", onClick: () => setFolder(was) },
    });
  };
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <div className="flex items-center gap-0.5">
          {ACTIONS.filter(({ from }) => from.includes(folder)).map(
            ({ label, key, icon: Icon, to }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    onClick={() => move(to)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {label} {key && <kbd className="font-mono">{key}</kbd>}
                </TooltipContent>
              </Tooltip>
            ),
          )}
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
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{thread?.subject}</h3>
          {folder !== "Inbox" && <Badge variant="outline">{folder}</Badge>}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setReply("");
            toast("Reply sent");
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
            <SendIcon />
            Send
          </Button>
        </form>
      </div>
    </TooltipProvider>
  );
}
