import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@orz/ui/components/toolbar";
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
  {
    label: "Text style",
    commands: [
      { label: "Bold", Icon: BoldIcon },
      { label: "Italic", Icon: ItalicIcon },
      { label: "Code", Icon: CodeIcon },
    ],
  },
  {
    label: "Blocks",
    commands: [
      { label: "Bulleted list", Icon: ListIcon },
      { label: "Numbered list", Icon: ListOrderedIcon },
      { label: "Quote", Icon: QuoteIcon },
    ],
  },
];

// The rarest commands come last: where the row does not fit, the toolbar
// moves them into its ⋯ menu first, then a whole group.
const RARE = [
  { label: "Link", Icon: LinkIcon },
  { label: "Attach a file", Icon: PaperclipIcon },
];

export function FormattingToolbar() {
  return (
    <Toolbar fit frame="card" aria-label="Formatting">
      {GROUPS.map(({ label, commands }) => (
        <Fragment key={label}>
          <ToolbarGroup label={label}>
            {commands.map(({ label, Icon }) => (
              <ToolbarButton key={label} aria-label={label}>
                <Icon />
              </ToolbarButton>
            ))}
          </ToolbarGroup>
          <ToolbarSeparator decorative={false} />
        </Fragment>
      ))}
      {RARE.map(({ label, Icon }) => (
        <ToolbarButton key={label} aria-label={label}>
          <Icon />
        </ToolbarButton>
      ))}
    </Toolbar>
  );
}
