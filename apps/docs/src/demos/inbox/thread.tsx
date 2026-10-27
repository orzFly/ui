import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";
import { Markdown } from "@orz/ui-markdown";
import { ArrowLeftIcon, SendIcon, StarIcon } from "lucide-react";
import { type Ref, useRef, useState } from "react";
import {
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

/**
 * The reply box, pinned to the bottom of the screen while the thread is in view. On a phone the
 * on-screen keyboard shrinks only the visual viewport, so `bottom` follows `--vv-bottom` from
 * `useVisualViewportInsets`, or the box would sit behind the keyboard it raised.
 */
function Composer({
  onSend,
  ref,
}: {
  onSend: (body: string) => void;
  ref: Ref<HTMLFormElement>;
}) {
  const editor = useRef<MarkdownEditorHandle>(null);
  const [empty, setEmpty] = useState(true);
  const send = (value: string) => {
    if (value.trim() === "") return;
    onSend(value.trim());
    editor.current?.setValue("");
    editor.current?.focus();
  };
  return (
    <form
      ref={ref}
      aria-label="Reply"
      onSubmit={(event) => {
        event.preventDefault();
        send(editor.current?.getValue() ?? "");
      }}
      className="sticky z-10 flex items-end gap-2 rounded-b-xl border-t bg-card p-3 md:rounded-bl-none"
      style={{ bottom: "var(--vv-bottom, 0px)" }}
    >
      <MarkdownEditor
        ref={editor}
        ariaLabel="Reply"
        placeholder="Reply in markdown…"
        onSubmit={send}
        onChange={(value) => setEmpty(value.trim() === "")}
        className="max-h-[30dvh] min-h-10 flex-1"
      />
      <Button type="submit" size="icon" aria-label="Send" disabled={empty}>
        <SendIcon />
      </Button>
    </form>
  );
}

/**
 * One conversation: its subject, the messages, and the reply box. On a phone it replaces the
 * list, and the back arrow returns to it.
 */
export function Thread({
  thread,
  onBack,
  onSend,
  headerRef,
  composerRef,
}: {
  thread: InboxThread;
  onBack: () => void;
  onSend: (body: string) => void;
  headerRef: Ref<HTMLElement>;
  composerRef: Ref<HTMLFormElement>;
}) {
  return (
    <article aria-labelledby="inbox-subject" className="flex flex-1 flex-col">
      <header
        ref={headerRef}
        // Under the site's own 3.5rem header; the card's top corners show above it.
        className="sticky top-14 z-10 flex items-center gap-2 border-b rounded-t-xl bg-card/95 px-2 py-2 backdrop-blur md:rounded-tl-none md:px-4"
      >
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Back to inbox"
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 id="inbox-subject" className="font-semibold leading-snug">
            {thread.subject}
          </h2>
          <p className="mt-1 flex flex-wrap gap-1">
            {thread.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </p>
        </div>
        {thread.starred && (
          <StarIcon
            aria-label="Starred"
            className="mr-2 size-4 shrink-0 fill-current text-foreground"
          />
        )}
      </header>
      <ol className="flex-1 divide-y">
        {thread.messages.map((message) => (
          <Message key={`${message.from}-${message.at}`} message={message} />
        ))}
      </ol>
      <Composer key={thread.id} ref={composerRef} onSend={onSend} />
    </article>
  );
}
