import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { List, ListItem } from "@orz/ui/components/list";
import { useState } from "react";

const THREADS = ["flaky-retry", "docs-search", "touch-sizes"].flatMap(
  (id) => INBOX_THREADS.find((thread) => thread.id === id) ?? [],
);

export function TruncatedSubjects() {
  const [open, setOpen] = useState(THREADS[0]?.id);
  const thread = THREADS.find(({ id }) => id === open);
  return (
    <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <List purpose="listbox" className="min-w-0">
        <ul aria-label="Conversations">
          {THREADS.map(({ id, subject, messages }) => (
            <li key={id}>
              <ListItem selected={id === open} asChild>
                <button
                  type="button"
                  aria-current={id === open ? "true" : undefined}
                  onClick={() => setOpen(id)}
                  className="flex min-h-row w-full items-baseline gap-2 px-3 py-2 text-left text-ui"
                >
                  <span className="min-w-0 flex-1 truncate">{subject}</span>
                  <span className="text-muted-foreground text-ui-sm">
                    {messages.length}
                  </span>
                </button>
              </ListItem>
            </li>
          ))}
        </ul>
      </List>
      {thread && (
        <article className="grid content-start gap-1">
          <h3 className="break-words font-heading font-medium text-prose">
            {thread.subject}
          </h3>
          <p className="text-muted-foreground text-ui-sm">
            {[
              ...new Set(
                thread.messages.map(({ from }) => INBOX_PEOPLE[from] ?? from),
              ),
            ].join(", ")}
          </p>
        </article>
      )}
    </div>
  );
}
