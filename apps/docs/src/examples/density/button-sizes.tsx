import { type AccessToken, TOKENS } from "@orz/fixtures/account.ts";
import { CI_RUN, type CiJob } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  ArchiveIcon,
  PlayIcon,
  ScrollTextIcon,
  SquarePenIcon,
} from "lucide-react";

const TOKEN = TOKENS[0] as AccessToken;
const JOB = CI_RUN.jobs[0] as CiJob;
const ICON_SIZES = ["icon-lg", "icon", "icon-sm", "icon-xs"] as const;

export function ButtonSizes() {
  return (
    <TooltipProvider>
      <dl className="grid grid-cols-[4.5rem_1fr] items-center gap-x-4 gap-y-4 text-ui">
        <dt className="font-mono text-muted-foreground text-ui-sm">lg</dt>
        <dd>
          <Button size="lg">
            <SquarePenIcon data-icon="inline-start" /> Compose
          </Button>
        </dd>
        <dt className="font-mono text-muted-foreground text-ui-sm">default</dt>
        <dd className="flex flex-wrap gap-2">
          <Button variant="outline">Discard changes</Button>
          <Button>Save profile</Button>
        </dd>
        <dt className="font-mono text-muted-foreground text-ui-sm">sm</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <PlayIcon data-icon="inline-start" /> Recording
          </Button>
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Revoke ${TOKEN.name}`}
          >
            Revoke…
          </Button>
        </dd>
        <dt className="font-mono text-muted-foreground text-ui-sm">xs</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate">{JOB.name}</span>
          <Button variant="ghost" size="xs" aria-label={`Log for ${JOB.name}`}>
            <ScrollTextIcon data-icon="inline-start" /> Log
          </Button>
        </dd>
        <dt className="font-mono text-muted-foreground text-ui-sm">icon-*</dt>
        <dd className="flex items-center gap-2">
          {ICON_SIZES.map((size) => (
            <Tooltip key={size}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size={size} aria-label="Archive">
                  <ArchiveIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>
          ))}
        </dd>
      </dl>
    </TooltipProvider>
  );
}
