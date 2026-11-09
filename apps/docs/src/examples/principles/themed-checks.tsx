import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Badge } from "@orz/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { InlineCode } from "@orz/ui/components/inline-code";
import { List, ListItem } from "@orz/ui/components/list";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";

export function ThemedChecks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0 flex-1 truncate">
          {CI_RUN.workflow} #{CI_RUN.id}
        </CardTitle>
        <CardAction>
          <InlineCode>{CI_RUN.branch}</InlineCode>
          <Badge variant="destructive">
            <CircleXIcon /> Failed
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <List purpose="collection">
          <ul className="text-ui">
            {CI_RUN.jobs.map((job) => (
              <ListItem key={job.id} asChild>
                <li className="flex min-h-row items-center gap-2 px-3 py-1.5">
                  {job.status === "failed" ? (
                    <CircleXIcon
                      aria-label="failed"
                      className="size-4 shrink-0 text-destructive"
                    />
                  ) : (
                    <CircleCheckIcon
                      aria-label="passed"
                      className="size-4 shrink-0 text-success"
                    />
                  )}
                  <span className="flex-1">{job.name}</span>
                  <span className="text-muted-foreground text-ui-sm tabular-nums">
                    {job.duration}s
                  </span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </CardContent>
    </Card>
  );
}
