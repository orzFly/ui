import { Button } from "@orz/ui/components/button";
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
      <div className="flex gap-0.5">
        {ACTIONS.map(({ label, key, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={label}>
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {label} <kbd className="font-mono">{key}</kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
