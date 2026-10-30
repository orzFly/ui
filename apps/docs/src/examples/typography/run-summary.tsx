import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { PULL_REQUEST } from "@orz/fixtures/pull-request.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";

const review = PULL_REQUEST.timeline.find(
  (event) => event.kind === "comment" && event.author === "claude-agent",
);
const paragraph =
  review?.kind === "comment"
    ? (review.body.split("\n\n")[0]?.replaceAll("\n", " ") ?? "")
    : "";

export function RunSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {CI_RUN.workflow} #{CI_RUN.id}
        </CardTitle>
        <CardDescription>
          Started <time dateTime={CI_RUN.startedAt}>Oct 21, 09:14 UTC</time> on{" "}
          <code className="font-mono text-ui-sm">{CI_RUN.branch}</code> at{" "}
          <code className="font-mono text-ui-sm">{CI_RUN.commit}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground text-ui-sm">
                Job
              </TableHead>
              <TableHead className="text-muted-foreground text-ui-sm">
                Status
              </TableHead>
              <TableHead className="text-right text-muted-foreground text-ui-sm">
                Time (s)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CI_RUN.jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {job.status === "failed" ? (
                      <CircleXIcon className="size-4 text-destructive" />
                    ) : (
                      <CircleCheckIcon className="size-4 text-success" />
                    )}
                    {job.status === "failed" ? "Failed" : "Passed"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.duration}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <blockquote className="grid max-w-prose gap-1 text-ui leading-6">
          <p>
            {paragraph.split("`").map((part, index) =>
              index % 2 === 1 ? (
                <code key={part} className="font-mono text-ui-sm">
                  {part}
                </code>
              ) : (
                part
              ),
            )}
          </p>
          <footer className="text-muted-foreground text-ui-sm">
            claude-agent, reviewing #{PULL_REQUEST.number}
          </footer>
        </blockquote>
      </CardContent>
    </Card>
  );
}
