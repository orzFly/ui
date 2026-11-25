import { DropdownMenuItem } from "@orz/ui/components/dropdown-menu";
import {
  Toolbar,
  ToolbarButton,
  ToolbarOverflow,
} from "@orz/ui/components/toolbar";
import {
  ArchiveIcon,
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
    <Toolbar aria-label="Thread actions" overflowAlign="start" className="p-0">
      {ACTIONS.map(({ label, key, Icon }) => (
        <ToolbarButton key={label} aria-label={label} shortcut={key}>
          <Icon />
        </ToolbarButton>
      ))}
      <ToolbarOverflow contentClassName="w-44">
        <DropdownMenuItem>
          <ForwardIcon /> Forward
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LinkIcon /> Copy link
        </DropdownMenuItem>
      </ToolbarOverflow>
    </Toolbar>
  );
}
