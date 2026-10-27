import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";

const ACTIONS = [
  { label: "Copy log", Icon: CopyIcon },
  { label: "Download log", Icon: DownloadIcon },
  { label: "Open raw log", Icon: ExternalLinkIcon },
];

export function NamedIconButtons() {
  return (
    <TooltipProvider>
      <div className="flex gap-1">
        {ACTIONS.map(({ label, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              {/* The name a screen reader announces; the tooltip shows the same words to sighted users. */}
              <Button variant="ghost" size="icon" aria-label={label}>
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
