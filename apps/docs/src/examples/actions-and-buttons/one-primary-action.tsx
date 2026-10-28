import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { SendIcon, Trash2Icon } from "lucide-react";

export function OnePrimaryAction() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Button>
          <SendIcon />
          Send
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Discard"
            >
              <Trash2Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Discard</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
