import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  SendIcon,
} from "lucide-react";

const TOOLS = [
  { label: "Bold", Icon: BoldIcon },
  { label: "Italic", Icon: ItalicIcon },
  { label: "Code", Icon: CodeIcon },
  { label: "Link", Icon: LinkIcon },
];

export function EditorToolbar() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {TOOLS.map(({ label, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={label}>
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
        <Button size="sm" className="ml-auto">
          Send <SendIcon data-icon="inline-end" />
        </Button>
      </div>
    </TooltipProvider>
  );
}
