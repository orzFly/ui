import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  CircleCheckIcon,
  CircleXIcon,
  EllipsisIcon,
  FilterIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

const RUNS = [
  { name: "build", branch: "master", passed: true },
  { name: "test", branch: "touch-sizing", passed: false },
  { name: "docs", branch: "master", passed: true },
];

const TOOLS = [
  { label: "Filter runs", Icon: FilterIcon },
  { label: "Refresh", Icon: RefreshCwIcon },
];

export function RunList() {
  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <div className="flex items-center gap-1 border-b px-3 py-1.5">
          <span className="flex-1 font-medium text-sm">Runs</span>
          {TOOLS.map(({ label, Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={label}>
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ul className="py-1">
          {RUNS.map((run) => (
            <li
              key={run.name}
              className="flex min-h-9 items-center gap-2 px-3 text-sm"
            >
              {run.passed ? (
                <CircleCheckIcon
                  aria-label="Passed"
                  className="size-4 shrink-0 text-(--diff-addition)"
                />
              ) : (
                <CircleXIcon
                  aria-label="Failed"
                  className="size-4 shrink-0 text-destructive"
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                {run.name}{" "}
                <span className="text-muted-foreground">on {run.branch}</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`More actions for ${run.name}`}
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() => toast(`Rerunning ${run.name}`)}
                  >
                    Rerun
                  </DropdownMenuItem>
                  <DropdownMenuItem>Copy link</DropdownMenuItem>
                  <DropdownMenuItem>Download log</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    Delete run
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  );
}
