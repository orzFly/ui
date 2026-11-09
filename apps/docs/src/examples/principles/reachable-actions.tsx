import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Kbd } from "@orz/ui/components/kbd";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton } from "@orz/ui/components/toolbar";
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
      <Pane purpose="toolbar" className="flex gap-0.5">
        {ACTIONS.map(({ label, key, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <ToolbarButton aria-label={label}>
                <Icon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>
              {label}
              <Kbd>{key}</Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ToolbarButton aria-label="More actions">
                  <EllipsisIcon />
                </ToolbarButton>
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
      </Pane>
    </TooltipProvider>
  );
}
