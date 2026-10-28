import { TOKENS } from "@orz/fixtures/account.ts";
import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  ArchiveIcon,
  CircleXIcon,
  KeyRoundIcon,
  MailIcon,
  Trash2Icon,
} from "lucide-react";

const [token] = TOKENS;

const TOOLBAR = [
  { label: "Archive", icon: ArchiveIcon },
  { label: "Delete", icon: Trash2Icon },
  { label: "Mark as unread", icon: MailIcon },
];

export function ButtonVariants() {
  return (
    <TooltipProvider>
      <div className="grid divide-y">
        <div className="flex flex-wrap items-center justify-end gap-2 pb-4">
          <span className="mr-auto font-mono text-muted-foreground text-xs">
            default, outline
          </span>
          <Button variant="outline">Discard changes</Button>
          <Button>Save profile</Button>
        </div>
        <div className="flex items-center gap-0.5 py-4">
          <span className="mr-auto font-mono text-muted-foreground text-xs">
            ghost
          </span>
          {TOOLBAR.map(({ label, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={label}>
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex items-center gap-3 py-4">
          <span className="font-mono text-muted-foreground text-xs">
            destructive
          </span>
          <KeyRoundIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium font-mono text-sm">
            {token?.name}
          </span>
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Revoke ${token?.name}`}
          >
            Revoke…
          </Button>
        </div>
        <div className="flex items-center gap-2 pt-4 text-sm">
          <span className="mr-auto font-mono text-muted-foreground text-xs">
            link
          </span>
          <CircleXIcon className="size-4 text-destructive" />
          <span>
            {CI_RUN.workflow} #{CI_RUN.id} {CI_RUN.status}
          </span>
          <Button variant="link" size="sm" className="h-auto px-0" asChild>
            <a href="#checks">Details</a>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
