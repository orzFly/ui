import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { List, ListItem } from "@orz/ui/components/list";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  CircleCheckIcon,
  CircleXIcon,
  PlayIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react";

export function CiRunPanel() {
  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <CircleXIcon
              aria-label="failed"
              className="size-4 shrink-0 text-destructive"
            />
            <span className="truncate">
              {CI_RUN.workflow} #{CI_RUN.id}
            </span>
          </CardTitle>
          <CardAction>
            <Button variant="outline" size="sm">
              <PlayIcon data-icon="inline-start" /> Recording
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Refresh">
                  <RefreshCwIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
        <CardContent>
          <List purpose="collection">
            <ul>
              {CI_RUN.jobs.map((job) => (
                <ListItem key={job.id} asChild>
                  <li className="flex min-h-row items-center gap-2 text-ui touch:min-h-11">
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
                    <span className="min-w-0 flex-1 truncate">{job.name}</span>
                    <span className="text-muted-foreground text-ui-sm tabular-nums">
                      {job.duration}s
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label={`Log for ${job.name}`}
                    >
                      <ScrollTextIcon data-icon="inline-start" /> Log
                    </Button>
                  </li>
                </ListItem>
              ))}
            </ul>
          </List>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline">Re-run all jobs</Button>
          <Button>Re-run failed jobs</Button>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
