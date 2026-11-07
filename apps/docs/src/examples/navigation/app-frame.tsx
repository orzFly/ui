import {
  NavList,
  NavListCount,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
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
    <div className="flex h-80 flex-col text-ui">
      <header className="flex h-11 shrink-0 items-stretch gap-4 border-b px-3">
        <span className="flex items-center font-semibold">Office</span>
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
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Folders"
          className="w-48 shrink-0 overflow-y-auto border-r bg-sidebar py-2"
        >
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
        <p className="p-4 text-muted-foreground">
          {section} · {place}
        </p>
      </div>
    </div>
  );
}
