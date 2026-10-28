import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
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
  Trash2Icon,
} from "lucide-react";

const ACTIONS = [
  { label: "Archive", key: "E", Icon: ArchiveIcon },
  { label: "Delete", key: "#", Icon: Trash2Icon },
  { label: "Mark as unread", key: "Shift U", Icon: MailIcon },
];

export function ReachableActions() {
  return (
    <TooltipProvider>
      <div className="flex gap-0.5">
        {ACTIONS.map(({ label, key, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={label}>
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {label}
              <kbd className="rounded-sm border bg-muted px-1 font-mono text-muted-foreground text-xs">
                {key}
              </kbd>
            </TooltipContent>
          </Tooltip>
        ))}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem>
              <ForwardIcon /> Forward
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LinkIcon /> Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
