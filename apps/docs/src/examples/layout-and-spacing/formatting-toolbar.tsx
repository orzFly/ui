import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton, ToolbarSeparator } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  BoldIcon,
  CodeIcon,
  EllipsisIcon,
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
];

// Below `sm` the rarest commands go into a ⋯ menu: on a phone's touch the
// whole row no longer fits.
const RARE = [
  { label: "Link", Icon: LinkIcon },
  { label: "Attach a file", Icon: PaperclipIcon },
];

export function FormattingToolbar() {
  return (
    <TooltipProvider>
      <Pane
        purpose="toolbar"
        frame="card"
        role="toolbar"
        aria-label="Formatting"
        className="flex w-fit items-center gap-0.5 p-1"
      >
        {GROUPS.map((group, i) => (
          <Fragment key={group[0]?.label}>
            {i > 0 && <ToolbarSeparator decorative={false} />}
            {group.map(({ label, Icon }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <ToolbarButton aria-label={label}>
                    <Icon />
                  </ToolbarButton>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </Fragment>
        ))}
        <ToolbarSeparator decorative={false} />
        {RARE.map(({ label, Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <ToolbarButton aria-label={label} className="max-sm:hidden">
                <Icon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ToolbarButton
                  aria-label="More formatting"
                  className="sm:hidden"
                >
                  <EllipsisIcon />
                </ToolbarButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More formatting</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {RARE.map(({ label, Icon }) => (
              <DropdownMenuItem key={label}>
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Pane>
    </TooltipProvider>
  );
}
