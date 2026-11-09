import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Kbd } from "@orz/ui/components/kbd";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function KeyWithoutButton() {
  return (
    <div className="grid gap-1">
      <h3 className="font-semibold">{thread?.subject}</h3>
      <p className="text-muted-foreground text-ui-sm">
        Press <Kbd>E</Kbd> to archive.
      </p>
    </div>
  );
}
