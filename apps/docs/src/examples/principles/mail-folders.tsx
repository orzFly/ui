import {
  NavList,
  NavListCount,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { isPlainClick } from "@orz/ui/lib/link";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  type LucideIcon,
  SendIcon,
} from "lucide-react";
import { useState } from "react";

const MAIL = `${import.meta.env.BASE_URL}demos/mail/`;

const FOLDERS: { query: string; title: string; Icon: LucideIcon }[] = [
  { query: "in:inbox", title: "Inbox", Icon: InboxIcon },
  { query: "in:sent", title: "Sent", Icon: SendIcon },
  { query: "in:drafts", title: "Drafts", Icon: FileTextIcon },
  { query: "in:archive", title: "Archive", Icon: ArchiveIcon },
];

export function MailFolders() {
  const [open, setOpen] = useState("in:inbox");
  return (
    <Pane purpose="sidebar" className="w-56 p-2">
      <NavListFrame asChild>
        <nav aria-label="Folders">
          <NavList>
            {FOLDERS.map(({ query, title, Icon }) => (
              <NavListItem key={query}>
                <NavListLink
                  href={`${MAIL}?q=${query}`}
                  current={query === open}
                  onClick={(event) => {
                    // Every other click is the browser's: a new tab, a new window, a menu.
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    setOpen(query);
                  }}
                >
                  <Icon />
                  {title}
                  {query === "in:inbox" && <NavListCount>8</NavListCount>}
                </NavListLink>
              </NavListItem>
            ))}
          </NavList>
        </nav>
      </NavListFrame>
    </Pane>
  );
}
