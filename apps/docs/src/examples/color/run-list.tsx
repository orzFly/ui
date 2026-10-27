import { Badge } from "@orz/ui/components/badge";
import { CircleCheckIcon, CircleXIcon, LoaderIcon } from "lucide-react";

const RUNS = [
  { id: 412, branch: "master", state: "failed", age: "3 min ago" },
  { id: 411, branch: "touch-sizing", state: "running", age: "9 min ago" },
  { id: 410, branch: "master", state: "passed", age: "1 h ago" },
] as const;

export function RunList() {
  return (
    <ul className="divide-y rounded-xl border bg-card text-card-foreground">
      {RUNS.map((run) => (
        <li key={run.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">Run {run.id}</p>
            <p className="truncate text-muted-foreground text-xs">
              {run.branch} · {run.age}
            </p>
          </div>
          {run.state === "failed" && (
            <Badge variant="destructive">
              <CircleXIcon /> Failed
            </Badge>
          )}
          {run.state === "running" && (
            <Badge variant="secondary">
              <LoaderIcon className="motion-safe:animate-spin" /> Running
            </Badge>
          )}
          {run.state === "passed" && (
            <Badge variant="success">
              <CircleCheckIcon /> Passed
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
