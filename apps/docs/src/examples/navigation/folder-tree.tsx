import { NavListFrame } from "@orz/ui/components/nav-list";
import { Tree, TreeCount, TreeItem, TreeLabel } from "@orz/ui/components/tree";
import { isPlainClick } from "@orz/ui/lib/link";
import { FolderIcon, FolderOpenIcon, InboxIcon, SendIcon } from "lucide-react";
import { useState } from "react";

interface Folder {
  id: string;
  name: string;
  unread?: number;
  children?: Folder[];
}

const FOLDERS: Folder[] = [
  {
    id: "inbox",
    name: "Inbox",
    unread: 8,
    children: [
      {
        id: "projects",
        name: "Projects",
        unread: 3,
        children: [
          { id: "website", name: "Website", unread: 2 },
          { id: "mobile-app", name: "Mobile app", unread: 1 },
          { id: "archive-2025", name: "2025" },
        ],
      },
      { id: "receipts", name: "Receipts" },
      { id: "newsletters", name: "Newsletters", unread: 5 },
    ],
  },
  { id: "sent", name: "Sent" },
  {
    id: "archive",
    name: "Archive",
    children: [
      { id: "archive-2024", name: "2024" },
      { id: "archive-2023", name: "2023" },
    ],
  },
];

export function FolderTree() {
  const [current, setCurrent] = useState("website");
  return (
    <NavListFrame className="max-w-64">
      <nav aria-label="Mail" className="py-2">
        <Tree aria-label="Folders" items={FOLDERS} current={current}>
          {(folder, row) => {
            const Icon =
              folder.id === "inbox"
                ? InboxIcon
                : folder.id === "sent"
                  ? SendIcon
                  : row.expanded
                    ? FolderOpenIcon
                    : FolderIcon;
            return (
              <TreeItem
                href={`#${folder.id}`}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  setCurrent(folder.id);
                }}
              >
                <Icon />
                <TreeLabel>{folder.name}</TreeLabel>
                {folder.unread && <TreeCount>{folder.unread}</TreeCount>}
              </TreeItem>
            );
          }}
        </Tree>
      </nav>
    </NavListFrame>
  );
}
