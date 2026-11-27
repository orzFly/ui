import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Pane } from "@orz/ui/components/pane";
import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import { isPlainClick } from "@orz/ui/lib/link";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

const SECTIONS = ["List", "Board", "Insights", "Settings"];

// The frame's corner drags it narrower. The search gives up its room first,
// down to its least; then the sections fold into the ⋯, the current one
// last; only then does the project's name truncate. The search takes no
// room of its own to start from (`basis-0`), so it grows only into what the
// sections leave.
export function SectionsHeader() {
  const [section, setSection] = useState("Board");
  return (
    <Pane
      purpose="panel"
      frame="inset"
      className="w-3xl min-w-48 max-w-full resize-x overflow-hidden"
    >
      <Pane
        purpose="banner"
        edge="bottom"
        asChild
        className="flex items-center gap-3 px-3"
      >
        <header>
          <span className="min-w-0 truncate font-semibold text-ui">
            Website relaunch
          </span>
          <TabNav aria-label="Project">
            {SECTIONS.map((name) => (
              <TabNavLink
                key={name}
                href={`#${name.toLowerCase()}`}
                current={name === section}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  setSection(name);
                }}
              >
                {name}
              </TabNavLink>
            ))}
          </TabNav>
          <Input
            type="search"
            aria-label="Search issues"
            placeholder="Search issues…"
            className="my-2 max-w-64 min-w-32 flex-1 basis-0"
          />
          <Button size="sm">
            <PlusIcon />
            New issue
          </Button>
        </header>
      </Pane>
    </Pane>
  );
}
