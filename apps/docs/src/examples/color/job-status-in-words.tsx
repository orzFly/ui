import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Badge } from "@orz/ui/components/badge";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";

export function JobStatusInWords() {
  return (
    <ul className="grid gap-2 text-ui">
      {CI_RUN.jobs.map((job) => (
        <li key={job.id} className="flex items-center justify-between gap-3">
          {job.name}
          {job.status === "failed" ? (
            <Badge variant="destructive">
              <CircleXIcon /> Failed
            </Badge>
          ) : (
            <Badge variant="success">
              <CircleCheckIcon /> Passed
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
