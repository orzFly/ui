import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { cn } from "@orz/ui/lib/utils";
import { useState } from "react";

const THREADS = ["flaky-retry", "docs-search", "touch-sizes"].flatMap(
  (id) => INBOX_THREADS.find((thread) => thread.id === id) ?? [],
);

export function TruncatedSubjects() {
  const [open, setOpen] = useState(THREADS[0]?.id);
  const thread = THREADS.find(({ id }) => id === open);
  return (
    <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <ul aria-label="Conversations" className="divide-y rounded-lg border">
        {THREADS.map(({ id, subject, messages }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={id === open ? "true" : undefined}
              onClick={() => setOpen(id)}
              className={cn(
                "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                id === open && "bg-accent",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{subject}</span>
              <span className="text-muted-foreground text-xs">
                {messages.length}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {thread && (
        <article className="grid content-start gap-1">
          <h3 className="break-words font-heading font-medium text-base">
            {thread.subject}
          </h3>
          <p className="text-muted-foreground text-xs">
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
