import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function MutedSecondaryLine() {
  return (
    <div className="grid gap-0.5">
      <p className="truncate font-medium text-sm">{thread?.subject}</p>
      <p className="text-muted-foreground text-xs">
        Alice, claude-agent ·{" "}
        <time dateTime="2026-10-27T10:50:00Z">Oct 27, 10:50 UTC</time>
      </p>
    </div>
  );
}
