import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@orz/ui/components/dropdown-menu";
import { Pane } from "@orz/ui/components/pane";
import {
  Toolbar,
  ToolbarButton,
  ToolbarMenu,
  ToolbarSearch,
  ToolbarSpacer,
} from "@orz/ui/components/toolbar";
import { CircleDotIcon, PlusIcon, UserIcon } from "lucide-react";
import { useState } from "react";

const STATUS = { open: "Open", closed: "Closed" };
const OWNER = { anyone: "Anyone", me: "Me" };

// The frame's corner drags it narrower: the toolbar lays itself out for the
// width it gets, not for the window's.
export function IssueToolbar() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<keyof typeof STATUS>("open");
  const [owner, setOwner] = useState<keyof typeof OWNER>("anyone");
  return (
    <Pane
      purpose="panel"
      frame="inset"
      className="w-xl min-w-48 max-w-full resize-x overflow-hidden"
    >
      <Toolbar aria-label="Issues" size="sm" className="gap-2 px-2 py-1.5">
        <ToolbarSearch
          label="Search issues"
          placeholder="Search…"
          minWidth={140}
          value={query}
          onValueChange={setQuery}
        />
        <ToolbarMenu
          icon={<CircleDotIcon />}
          label="Status"
          value={STATUS[status]}
          active={status !== "open"}
        >
          <DropdownMenuRadioGroup
            value={status}
            onValueChange={(next) => setStatus(next as keyof typeof STATUS)}
          >
            {Object.entries(STATUS).map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarMenu
          icon={<UserIcon />}
          label="Owner"
          value={OWNER[owner]}
          active={owner !== "anyone"}
        >
          <DropdownMenuRadioGroup
            value={owner}
            onValueChange={(next) => setOwner(next as keyof typeof OWNER)}
          >
            {Object.entries(OWNER).map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarSpacer />
        <ToolbarButton variant="default" priority="pin">
          <PlusIcon />
          New issue
        </ToolbarButton>
      </Toolbar>
    </Pane>
  );
}
