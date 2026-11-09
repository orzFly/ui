import {
  NavList,
  NavListCount,
  NavListFrame,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  SendIcon,
  TagIcon,
} from "lucide-react";
import { useState } from "react";

const SECTIONS = ["Mail", "Calendar", "Contacts"];

const FOLDERS = [
  { title: "Inbox", Icon: InboxIcon, count: 8 },
  { title: "Sent", Icon: SendIcon, count: 0 },
  { title: "Drafts", Icon: FileTextIcon, count: 1 },
  { title: "Archive", Icon: ArchiveIcon, count: 0 },
];

const LABELS = ["review", "release", "support"];

export function AppFrame() {
  const [section, setSection] = useState("Mail");
  const [place, setPlace] = useState("Inbox");
  return (
    <Pane purpose="app" className="flex h-80 flex-col">
      <Pane
        purpose="banner"
        edge="bottom"
        asChild
        className="flex h-11 shrink-0 items-stretch gap-4 px-3"
      >
        <header>
          <span className="flex items-center font-semibold text-ui">
            Office
          </span>
          <TabNav aria-label="Sections">
            {SECTIONS.map((name) => (
              <TabNavLink
                key={name}
                href={`#${name.toLowerCase()}`}
                current={name === section}
                onClick={(event) => {
                  event.preventDefault();
                  setSection(name);
                }}
              >
                {name}
              </TabNavLink>
            ))}
          </TabNav>
        </header>
      </Pane>
      <div className="flex min-h-0 flex-1">
        <Pane
          purpose="sidebar"
          edge="end"
          className="flex w-48 shrink-0 flex-col"
        >
          <NavListFrame className="min-h-0 flex-1">
            <nav aria-label="Folders" className="h-full overflow-y-auto py-2">
              <NavList>
                {FOLDERS.map(({ title, Icon, count }) => (
                  <NavListItem key={title}>
                    <NavListLink current={title === place} asChild>
                      <button type="button" onClick={() => setPlace(title)}>
                        <Icon />
                        {title}
                        {count > 0 && <NavListCount>{count}</NavListCount>}
                      </button>
                    </NavListLink>
                  </NavListItem>
                ))}
                <NavListItem>
                  <NavListHeading asChild>
                    <h3>Labels</h3>
                  </NavListHeading>
                  <NavList>
                    {LABELS.map((label) => (
                      <NavListItem key={label}>
                        <NavListLink current={label === place} asChild>
                          <button type="button" onClick={() => setPlace(label)}>
                            <TagIcon />
                            {label}
                          </button>
                        </NavListLink>
                      </NavListItem>
                    ))}
                  </NavList>
                </NavListItem>
              </NavList>
            </nav>
          </NavListFrame>
        </Pane>
        <Pane purpose="document" className="min-w-0 flex-1">
          <p className="p-4 text-muted-foreground text-ui">
            {section} · {place}
          </p>
        </Pane>
      </div>
    </Pane>
  );
}
