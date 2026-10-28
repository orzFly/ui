import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { useState } from "react";

const THREADS = INBOX_THREADS.filter(
  ({ folder }) => folder === undefined,
).slice(0, 3);

export function ConversationsFailed() {
  const [loaded, setLoaded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  if (!loaded) {
    return (
      <LoadFailure
        message="Couldn't load the conversations."
        detail="503 Service Unavailable"
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          setTimeout(() => {
            setRetrying(false);
            setLoaded(true);
          }, 800);
        }}
      />
    );
  }
  return (
    <ul aria-label="Conversations" className="divide-y text-sm">
      {THREADS.map(({ id, subject }) => (
        <li key={id} className="truncate py-2">
          {subject}
        </li>
      ))}
    </ul>
  );
}
