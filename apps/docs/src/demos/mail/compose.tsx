import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { cn } from "@orz/ui/lib/utils";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";
import {
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { ActionButton } from "./keys.tsx";
import { type Draft, INBOX_ME, INBOX_PEOPLE, recipientsOf } from "./mailbox.ts";

/** How the window sits: docked at the bottom right, folded to its title, or grown. */
type Size = "docked" | "minimised" | "expanded";

/** Why `to` cannot be sent to, or null when it can. */
function recipientError(to: string): string | null {
  const logins = recipientsOf(to);
  if (logins.length === 0) return "Add at least one recipient.";
  const unknown = logins.filter(
    (login) => !(login in INBOX_PEOPLE) || login === INBOX_ME,
  );
  if (unknown.length === 0) return null;
  return `No one here is called ${unknown.join(", ")}. Try ${Object.keys(
    INBOX_PEOPLE,
  )
    .filter((login) => login !== INBOX_ME)
    .slice(0, 3)
    .join(", ")}.`;
}

/**
 * A new message, in a window docked at the bottom right of a wide screen so the list and the open
 * thread stay in reach; on a phone it takes the whole app. Closing it keeps what was written as a
 * draft, and Discard throws it away; the owner decides what each leaves behind.
 */
export function Compose({
  draft,
  onClose,
  onDiscard,
  onSend,
}: {
  /** Read once, at mount: key the window by the draft's id to open another. */
  draft: Draft;
  onClose: (draft: Draft) => void;
  onDiscard: (draft: Draft) => void;
  onSend: (draft: Draft) => void;
}) {
  const [size, setSize] = useState<Size>("docked");
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<MarkdownEditorHandle>(null);
  const current = (): Draft => ({
    id: draft.id,
    to,
    subject,
    body: editor.current?.getValue() ?? draft.body,
  });
  const send = () => {
    const problem = recipientError(to);
    setError(problem);
    if (problem) {
      document.getElementById("compose-to")?.focus();
      return;
    }
    onSend(current());
  };

  return (
    <section
      aria-labelledby="compose-title"
      className={cn(
        "absolute z-30 flex flex-col overflow-hidden bg-background shadow-2xl",
        // A phone has room for nothing beside it.
        "max-md:inset-0",
        "md:right-4 md:bottom-0 md:rounded-t-xl md:border md:border-b-0",
        size === "docked" && "md:h-[min(30rem,calc(100%-2rem))] md:w-[30rem]",
        size === "minimised" && "md:w-72",
        size === "expanded" &&
          "md:top-4 md:left-4 md:max-w-3xl md:rounded-b-xl md:border-b lg:left-auto lg:w-[48rem] md:bottom-4",
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-muted/50 pr-2 pl-1 md:h-10 md:pr-1 md:pl-3">
        <ActionButton
          label="Close and keep as a draft"
          className="md:hidden"
          onClick={() => onClose(current())}
        >
          <XIcon />
        </ActionButton>
        <h2
          id="compose-title"
          className="min-w-0 flex-1 truncate font-medium text-ui"
        >
          {subject.trim() || "New message"}
        </h2>
        <span data-compose-controls className="max-md:hidden">
          <ActionButton
            label={size === "minimised" ? "Restore" : "Minimise"}
            size="icon-sm"
            onClick={() =>
              setSize(size === "minimised" ? "docked" : "minimised")
            }
          >
            <MinusIcon />
          </ActionButton>
          <ActionButton
            label={size === "expanded" ? "Shrink" : "Expand"}
            size="icon-sm"
            onClick={() => setSize(size === "expanded" ? "docked" : "expanded")}
          >
            {size === "expanded" ? <Minimize2Icon /> : <Maximize2Icon />}
          </ActionButton>
          <ActionButton
            label="Close and keep as a draft"
            size="icon-sm"
            onClick={() => onClose(current())}
          >
            <XIcon />
          </ActionButton>
        </span>
        <Button size="sm" className="md:hidden" onClick={send}>
          Send
        </Button>
      </header>
      <form
        aria-label="New message"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          size === "minimised" && "md:hidden",
        )}
      >
        <div className="border-b">
          <div className="flex items-center gap-2 px-3">
            <label
              htmlFor="compose-to"
              className="w-14 text-muted-foreground text-ui"
            >
              To
            </label>
            <Input
              id="compose-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              list="compose-people"
              autoComplete="off"
              placeholder="alice, newcomer"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "compose-to-error" : undefined}
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          {error && (
            <p
              id="compose-to-error"
              className="px-3 pb-2 text-destructive text-ui-sm"
            >
              {error}
            </p>
          )}
          <datalist id="compose-people">
            {Object.entries(INBOX_PEOPLE)
              .filter(([login]) => login !== INBOX_ME)
              .map(([login, name]) => (
                <option key={login} value={login}>
                  {name}
                </option>
              ))}
          </datalist>
        </div>
        <div className="flex items-center gap-2 border-b px-3">
          <label
            htmlFor="compose-subject"
            className="w-14 text-muted-foreground text-ui"
          >
            Subject
          </label>
          <Input
            id="compose-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <MarkdownEditor
          ref={editor}
          ariaLabel="Message"
          placeholder="Write in markdown…"
          initialValue={draft.body}
          onSubmit={send}
          className="min-h-0 flex-1 overflow-y-auto rounded-none border-0 px-1 focus-within:ring-0"
        />
        <div className="flex items-center gap-2 border-t p-2 max-md:hidden">
          <Button type="submit">
            <SendIcon />
            Send
          </Button>
          <span className="flex-1" />
          <ActionButton label="Discard" onClick={() => onDiscard(current())}>
            <Trash2Icon />
          </ActionButton>
        </div>
        <div className="flex border-t p-2 md:hidden">
          <Button variant="ghost" onClick={() => onDiscard(current())}>
            <Trash2Icon />
            Discard
          </Button>
        </div>
      </form>
    </section>
  );
}
