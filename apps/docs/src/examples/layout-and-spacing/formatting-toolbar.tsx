import { Button } from "@orz/ui/components/button";
import { Separator } from "@orz/ui/components/separator";
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
  ListIcon,
  ListOrderedIcon,
  PaperclipIcon,
  QuoteIcon,
} from "lucide-react";
import { Fragment } from "react";

const GROUPS = [
  [
    { label: "Bold", Icon: BoldIcon },
    { label: "Italic", Icon: ItalicIcon },
    { label: "Code", Icon: CodeIcon },
  ],
  [
    { label: "Bulleted list", Icon: ListIcon },
    { label: "Numbered list", Icon: ListOrderedIcon },
    { label: "Quote", Icon: QuoteIcon },
  ],
  [
    { label: "Link", Icon: LinkIcon },
    { label: "Attach a file", Icon: PaperclipIcon },
  ],
];

export function FormattingToolbar() {
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex w-fit items-center gap-0.5 rounded-lg border p-1"
      >
        {GROUPS.map((group, i) => (
          <Fragment key={group[0]?.label}>
            {i > 0 && (
              <Separator
                orientation="vertical"
                decorative={false}
                className="mx-1 my-1.5"
              />
            )}
            {group.map(({ label, Icon }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={label}>
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </Fragment>
        ))}
      </div>
    </TooltipProvider>
  );
}
