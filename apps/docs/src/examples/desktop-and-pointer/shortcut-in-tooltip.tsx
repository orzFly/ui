import { Kbd } from "@orz/ui/components/kbd";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { ArchiveIcon, MailIcon, Trash2Icon } from "lucide-react";

const ACTIONS = [
  { label: "Archive", key: "E", Icon: ArchiveIcon },
  { label: "Delete", key: "#", Icon: Trash2Icon },
  { label: "Mark as unread", key: "Shift U", Icon: MailIcon },
];

export function ShortcutInTooltip() {
  return (
    <TooltipProvider>
      <Pane purpose="toolbar" className="flex gap-0.5 px-1.5">
        {ACTIONS.map(({ label, key, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <ToolbarButton aria-label={label}>
                <Icon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>
              {label} <Kbd>{key}</Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </Pane>
    </TooltipProvider>
  );
}
