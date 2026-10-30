import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function KeyWithoutButton() {
  return (
    <div className="grid gap-1">
      <h3 className="font-semibold">{thread?.subject}</h3>
      <p className="text-muted-foreground text-ui-sm">
        Press <kbd className="font-mono">E</kbd> to archive.
      </p>
    </div>
  );
}
