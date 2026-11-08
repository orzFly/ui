import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { List, ListItem } from "@orz/ui/components/list";
import {
  NavList,
  NavListCount,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  KeyboardIcon,
  type LucideIcon,
  MailIcon,
  SendIcon,
  SquarePenIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentProps, MouseEvent } from "react";
import { placeHref } from "./location.ts";
import { INBOX_LABELS } from "./mailbox.ts";

/** A place in the sidebar: a folder or a filter, each no more than a saved search. */
interface Place {
  query: string;
  title: string;
  Icon: LucideIcon;
  /** What the place holds and how something gets there, for when it holds nothing. */
  empty: string;
}

export const PLACES: readonly Place[] = [
  {
    query: "in:inbox",
    title: "Inbox",
    Icon: InboxIcon,
    empty: "New mail lands here. Archive what you have dealt with.",
  },
  {
    query: "is:starred",
    title: "Starred",
    Icon: StarIcon,
    empty: "Star a conversation to find it here later.",
  },
  {
    query: "in:sent",
    title: "Sent",
    Icon: SendIcon,
    empty: "Every message you send is kept here.",
  },
  {
    query: "in:drafts",
    title: "Drafts",
    Icon: FileTextIcon,
    empty: "A message you close without sending waits here.",
  },
  {
    query: "in:archive",
    title: "Archive",
    Icon: ArchiveIcon,
    empty: "Archived conversations leave the inbox and wait here.",
  },
  {
    query: "in:trash",
    title: "Trash",
    Icon: Trash2Icon,
    empty: "Deleted conversations wait here until you delete them forever.",
  },
];

/** A plain click opens in place; a modified one is the browser's, a new tab say. */
export const isPlainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export interface SidebarProps {
  /** The search on screen, to mark the place it is. */
  query: string;
  /** Unread or waiting counts beside a place, by its query. */
  counts: Readonly<Record<string, number>>;
  onShow: (query: string) => void;
  onCompose: () => void;
  onKeys: () => void;
}

/** A place as a link, so it opens in a new tab too; a plain click stays in the app. */
function PlaceLink({
  query,
  onShow,
  current,
  ...props
}: ComponentProps<"a"> & {
  query: string;
  onShow: (query: string) => void;
  /** Left out under a `NavListLink`, which marks the place itself. */
  current?: boolean;
}) {
  return (
    <a
      {...props}
      href={placeHref(query)}
      aria-current={
        current === undefined
          ? props["aria-current"]
          : current
            ? "page"
            : undefined
      }
      onClick={(event) => {
        props.onClick?.(event);
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onShow(query);
      }}
    />
  );
}

/**
 * The folders, the labels and the account, in full: a wide screen's sidebar, and the phone's
 * drawer.
 */
export function Sidebar({
  query,
  counts,
  onShow,
  onCompose,
  onKeys,
}: SidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <p className="flex items-center gap-2 px-1 font-semibold">
        <span className="grid size-7 place-content-center rounded-md bg-primary text-primary-foreground">
          <MailIcon className="size-4" />
        </span>
        Mail
      </p>
      <Button onClick={onCompose} className="justify-start">
        <SquarePenIcon />
        Compose
      </Button>
      <List purpose="nav" className="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Folders" className="min-h-0 flex-1 overflow-y-auto">
          <NavList>
            {PLACES.map(({ query: place, title, Icon }) => (
              <NavListItem key={place}>
                <NavListLink current={query === place} asChild>
                  <PlaceLink query={place} onShow={onShow}>
                    <Icon />
                    {title}
                    {(counts[place] ?? 0) > 0 && (
                      <NavListCount>{counts[place]}</NavListCount>
                    )}
                  </PlaceLink>
                </NavListLink>
              </NavListItem>
            ))}
          </NavList>
          <NavListHeading asChild>
            <h2>Labels</h2>
          </NavListHeading>
          <NavList>
            {INBOX_LABELS.map((label) => (
              <NavListItem key={label}>
                <NavListLink current={query === `label:${label}`} asChild>
                  <PlaceLink query={`label:${label}`} onShow={onShow}>
                    <TagIcon />
                    {label}
                  </PlaceLink>
                </NavListLink>
              </NavListItem>
            ))}
          </NavList>
        </nav>
      </List>
      <div className="flex items-center gap-2 border-t pt-3">
        <Avatar size="sm" aria-hidden>
          <AvatarFallback>Y</AvatarFallback>
        </Avatar>
        <span className="flex-1 text-ui">You</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Keyboard shortcuts"
              onClick={onKeys}
            >
              <KeyboardIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/** The sidebar folded to its icons, for a screen with room for the list and a thread but no more. */
export function Rail({
  query,
  counts,
  onShow,
  onCompose,
  onKeys,
}: SidebarProps) {
  const icon =
    "relative grid size-9 place-content-center rounded-md text-muted-foreground hover:text-foreground [&_svg]:size-4";
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-lg" aria-label="Compose" onClick={onCompose}>
            <SquarePenIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Compose</TooltipContent>
      </Tooltip>
      <List purpose="nav" asChild>
        <nav aria-label="Folders" className="mt-2">
          <ul className="grid gap-1">
            {PLACES.map(({ query: place, title, Icon }) => (
              <li key={place}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ListItem asChild current={query === place}>
                      <PlaceLink
                        query={place}
                        onShow={onShow}
                        current={query === place}
                        aria-label={
                          counts[place] ? `${title}, ${counts[place]}` : title
                        }
                        className={cn(
                          icon,
                          query === place && "text-foreground",
                        )}
                      >
                        <Icon />
                        {(counts[place] ?? 0) > 0 && (
                          <span
                            aria-hidden
                            className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-[0.6rem] text-primary-foreground leading-4 tabular-nums"
                          >
                            {counts[place]}
                          </span>
                        )}
                      </PlaceLink>
                    </ListItem>
                  </TooltipTrigger>
                  <TooltipContent side="right">{title}</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>
      </List>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" aria-label="Labels">
                <TagIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Labels</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          {INBOX_LABELS.map((label) => (
            <DropdownMenuItem
              key={label}
              onSelect={() => onShow(`label:${label}`)}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Keyboard shortcuts"
            className="mt-auto"
            onClick={onKeys}
          >
            <KeyboardIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Keyboard shortcuts</TooltipContent>
      </Tooltip>
    </div>
  );
}
