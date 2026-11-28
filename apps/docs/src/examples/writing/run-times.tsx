import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import { Timestamp } from "@orz/ui/components/timestamp";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

const LOGS_KEPT_UNTIL = new Date(
  Date.parse(CI_RUN.startedAt) + 90 * 24 * 60 * 60 * 1000,
).toISOString();

export function RunTimes() {
  const [refreshed, setRefreshed] = useState(CI_RUN.startedAt);
  return (
    <dl className="grid w-fit grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 text-ui">
      <dt className="text-muted-foreground">Started</dt>
      <dd>
        <Timestamp value={CI_RUN.startedAt} />
      </dd>
      <dt className="text-muted-foreground">Logs kept until</dt>
      <dd>
        <Timestamp value={LOGS_KEPT_UNTIL} format="date" />
      </dd>
      <dt className="text-muted-foreground">Checks refreshed</dt>
      <dd className="flex items-center gap-2">
        <Timestamp value={refreshed} format="relative" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshed(new Date().toISOString())}
        >
          <RefreshCwIcon />
          Refresh
        </Button>
      </dd>
    </dl>
  );
}
