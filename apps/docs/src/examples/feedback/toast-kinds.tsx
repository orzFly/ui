import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import { ArchiveIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const failed = CI_RUN.jobs.filter((job) => job.status === "failed");

export function ToastKinds() {
  const [archived, setArchived] = useState(false);
  const [running, setRunning] = useState(false);
  const [details, setDetails] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={archived}
          onClick={() => {
            setArchived(true);
            toast("Conversation archived", {
              action: { label: "Undo", onClick: () => setArchived(false) },
            });
          }}
        >
          <ArchiveIcon />
          Archive
        </Button>
        <Button
          variant="outline"
          disabled={running}
          onClick={() => {
            setRunning(true);
            setDetails(false);
            setTimeout(() => {
              setRunning(false);
              const [job] = failed;
              if (!job) return;
              toast.error(`${job.name} failed again in ${CI_RUN.workflow}`, {
                action: { label: "Details", onClick: () => setDetails(true) },
              });
            }, 1500);
          }}
        >
          <RotateCwIcon className={running ? "animate-spin" : undefined} />
          {running ? "Re-running…" : "Re-run failed jobs"}
        </Button>
      </div>
      {details && (
        <ul className="divide-y rounded-lg border text-sm">
          {CI_RUN.jobs.map((job) => (
            <li key={job.id} className="flex justify-between gap-2 px-3 py-2">
              <span>
                {CI_RUN.workflow} / {job.name}
              </span>
              <span className="text-muted-foreground">{job.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
