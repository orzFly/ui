import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Card, CardContent, CardFooter } from "@orz/ui/components/card";
import { InlineCode } from "@orz/ui/components/inline-code";
import { List, ListItem } from "@orz/ui/components/list";
import { CircleCheckIcon, CircleXIcon, GitMergeIcon } from "lucide-react";

const failed = CI_RUN.jobs.filter((job) => job.status === "failed").length;

export function MergeBox() {
  return (
    <Card role="region" aria-labelledby="merge-box-status">
      <CardContent className="flex items-start gap-3">
        <CircleXIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h3 id="merge-box-status" className="font-medium">
            Some checks were not successful
          </h3>
          <p className="text-muted-foreground text-ui">
            {failed} failing and {CI_RUN.jobs.length - failed} successful checks
            on <InlineCode>{CI_RUN.commit}</InlineCode>
          </p>
        </div>
      </CardContent>
      <CardContent>
        <List purpose="collection">
          <ul>
            {CI_RUN.jobs.map((job) => (
              <ListItem key={job.id} asChild>
                <li className="flex min-h-row items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-ui">
                    {CI_RUN.workflow} / {job.name}
                  </span>
                  <span className="text-muted-foreground text-ui-sm tabular-nums">
                    {job.duration}s
                  </span>
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
              </ListItem>
            ))}
          </ul>
        </List>
      </CardContent>
      <CardFooter className="flex-wrap gap-3">
        <Button disabled>
          <GitMergeIcon />
          Merge pull request
        </Button>
        <p className="text-muted-foreground text-ui">
          Merging is blocked until every check passes.
        </p>
      </CardFooter>
    </Card>
  );
}
