import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  NavList,
  NavListCount,
  NavListFrame,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { isPlainClick } from "@orz/ui/lib/link";
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
import type { ComponentProps } from "react";
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
export function PlaceLink({
  query,
  onShow,
  ...props
}: ComponentProps<"a"> & {
  query: string;
  onShow: (query: string) => void;
}) {
  return (
    <a
      {...props}
      href={placeHref(query)}
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
      <NavListFrame className="flex min-h-0 flex-1 flex-col">
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
      </NavListFrame>
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
      <NavListFrame asChild>
        <nav aria-label="Folders" className="mt-2">
          <NavList className="gap-1">
            {PLACES.map(({ query: place, title, Icon }) => (
              <NavListItem key={place}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavListLink
                      asChild
                      current={query === place}
                      className="size-9 justify-center px-0 touch:w-11"
                    >
                      <PlaceLink
                        query={place}
                        onShow={onShow}
                        aria-label={
                          counts[place] ? `${title}, ${counts[place]}` : title
                        }
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
                    </NavListLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{title}</TooltipContent>
                </Tooltip>
              </NavListItem>
            ))}
          </NavList>
        </nav>
      </NavListFrame>
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
