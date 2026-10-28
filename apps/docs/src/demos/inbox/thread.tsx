import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";
import { Markdown } from "@orz/ui-markdown";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  EllipsisIcon,
  ForwardIcon,
  InboxIcon,
  LinkIcon,
  MailIcon,
  SendIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { type Ref, useImperativeHandle, useRef } from "react";
import { ActionButton } from "./keys.tsx";
import {
  folderOf,
  INBOX_LABELS,
  INBOX_PEOPLE,
  type InboxMessage,
  type InboxThread,
} from "./mailbox.ts";

/** UTC, so the prerender and every reader's browser print the same thing. */
const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export const nameOf = (login: string) => INBOX_PEOPLE[login] ?? login;

function Message({ message }: { message: InboxMessage }) {
  const name = nameOf(message.from);
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-4">
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{name}</span>
        {message.to && message.to.length > 0 && (
          <span className="text-muted-foreground text-xs">
            to {message.to.map(nameOf).join(", ")}
          </span>
        )}
        <time
          dateTime={message.at}
          className="text-muted-foreground text-xs tabular-nums"
        >
          {STAMP.format(new Date(message.at))} UTC
        </time>
      </p>
      <Markdown className="col-start-2 min-w-0 text-sm">
        {message.body}
      </Markdown>
    </li>
  );
}

/** What the reply box lets the thread around it do. */
export interface ComposerHandle {
  focus: () => void;
}

/**
 * The reply box, pinned to the bottom of the thread while it scrolls. On a phone the on-screen
 * keyboard shrinks only the visual viewport, so `bottom` follows `--vv-bottom` from
 * `useVisualViewportInsets`, or the box would sit behind the keyboard it raised.
 */
function Composer({
  onSend,
  ref,
}: {
  onSend: (body: string) => void;
  ref: Ref<ComposerHandle>;
}) {
  const editor = useRef<MarkdownEditorHandle>(null);
  useImperativeHandle(ref, () => ({ focus: () => editor.current?.focus() }));
  // Send is never greyed out unexplained: with nothing written it lands on the box, whose
  // placeholder says what goes there.
  const send = (value: string) => {
    if (value.trim() === "") {
      editor.current?.focus();
      return;
    }
    onSend(value.trim());
    editor.current?.setValue("");
    editor.current?.focus();
  };
  return (
    <form
      aria-label="Reply"
      onSubmit={(event) => {
        event.preventDefault();
        send(editor.current?.getValue() ?? "");
      }}
      className="sticky z-10 flex items-end gap-2 border-t bg-background p-3"
      style={{ bottom: "var(--vv-bottom, 0px)" }}
    >
      <MarkdownEditor
        ref={editor}
        ariaLabel="Reply"
        placeholder="Reply in markdown…"
        onSubmit={send}
        className="max-h-[30dvh] min-h-10 flex-1"
      />
      <Button type="submit">
        <SendIcon />
        Send
      </Button>
    </form>
  );
}

/** What can be done to the open thread; each is undone from the toast it ends in. */
export interface ThreadActions {
  onBack: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  /** The one action that is not undone from a toast: it asks first. */
  onDeleteForever: () => void;
  onUnread: () => void;
  onStar: () => void;
  onLabel: (label: string, on: boolean) => void;
  onForward: () => void;
  onCopyLink: () => void;
}

function Toolbar({
  thread,
  actions,
}: {
  thread: InboxThread;
  actions: ThreadActions;
}) {
  const folder = folderOf(thread);
  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-2 touch:h-14">
      <ActionButton
        label="Back to inbox"
        action="back"
        className="md:hidden"
        onClick={actions.onBack}
      >
        <ArrowLeftIcon />
      </ActionButton>
      {folder === "archive" || folder === "trash" ? (
        <ActionButton label="Move to Inbox" onClick={actions.onRestore}>
          {folder === "trash" ? <Undo2Icon /> : <InboxIcon />}
        </ActionButton>
      ) : (
        <ActionButton
          label="Archive"
          action="archive"
          onClick={actions.onArchive}
        >
          <ArchiveIcon />
        </ActionButton>
      )}
      {folder !== "trash" && (
        <ActionButton label="Delete" action="trash" onClick={actions.onTrash}>
          <Trash2Icon />
        </ActionButton>
      )}
      <ActionButton
        label="Mark as unread"
        action="unread"
        onClick={actions.onUnread}
      >
        <MailIcon />
      </ActionButton>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Labels">
                <TagIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Labels</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          {INBOX_LABELS.map((label) => (
            <DropdownMenuCheckboxItem
              key={label}
              checked={thread.labels.includes(label)}
              onCheckedChange={(on) => actions.onLabel(label, on)}
              // A reader ticks several in a row; the menu stays open for the next.
              onSelect={(event) => event.preventDefault()}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="flex-1" />
      <ActionButton
        // A toggle keeps one name and says its state as pressed; "Unstar" would read as pressed Unstar.
        label="Star"
        action="star"
        aria-pressed={thread.starred}
        onClick={actions.onStar}
      >
        <StarIcon className={thread.starred ? "fill-current" : undefined} />
      </ActionButton>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={actions.onForward}>
            <ForwardIcon />
            Forward
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onCopyLink}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          {folder === "trash" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={actions.onDeleteForever}
              >
                <Trash2Icon />
                Delete forever…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * One conversation: the actions on it, its subject, the messages, and the reply box. On a phone
 * it replaces the list, and the back arrow returns to it.
 */
export function Thread({
  thread,
  actions,
  onSend,
  composerRef,
  scrollRef,
}: {
  thread: InboxThread;
  actions: ThreadActions;
  onSend: (body: string) => void;
  composerRef: Ref<ComposerHandle>;
  scrollRef: Ref<HTMLDivElement>;
}) {
  // A thread in the bin is read, not answered: Move to Inbox first.
  const canReply = folderOf(thread) !== "trash";
  return (
    <article
      aria-labelledby="inbox-subject"
      className="flex min-h-0 flex-1 flex-col"
    >
      <Toolbar thread={thread} actions={actions} />
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <header className="border-b px-4 py-3">
          <h2 id="inbox-subject" className="font-semibold text-lg leading-snug">
            {thread.subject}
          </h2>
          {thread.labels.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {thread.labels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </p>
          )}
        </header>
        <ol className="flex-1 divide-y">
          {thread.messages.map((message) => (
            <Message key={`${message.from}-${message.at}`} message={message} />
          ))}
        </ol>
        {canReply && (
          <Composer key={thread.id} ref={composerRef} onSend={onSend} />
        )}
      </div>
    </article>
  );
}
