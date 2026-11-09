import { PULL_REQUEST } from "@orz/fixtures/pull-request.ts";
import { Button } from "@orz/ui/components/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import { TextLink } from "@orz/ui/components/text-link";
import { RotateCwIcon } from "lucide-react";
import { toast } from "sonner";

const REVIEWER = PULL_REQUEST.reviewers[0] ?? "claude-agent";

export function PreviewOnHover() {
  return (
    <div className="flex items-center gap-2 text-ui">
      <HoverCard>
        <HoverCardTrigger asChild>
          <TextLink href={`#${REVIEWER}`}>{REVIEWER}</TextLink>
        </HoverCardTrigger>
        <HoverCardContent className="w-64">
          <p className="font-medium text-ui">{REVIEWER}</p>
          <p className="text-muted-foreground text-ui">
            Reviewer on #{PULL_REQUEST.number}. Commented on Oct 21.
          </p>
        </HoverCardContent>
      </HoverCard>
      <span className="flex-1 text-muted-foreground">Reviewer</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toast(`Review requested from ${REVIEWER}`)}
      >
        <RotateCwIcon />
        Re-request review
      </Button>
    </div>
  );
}
