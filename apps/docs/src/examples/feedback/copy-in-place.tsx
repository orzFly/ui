import { TASKS } from "@orz/fixtures/tasks.ts";
import { CopyButton } from "@orz/ui/components/copy-button";
import { LinkIcon } from "lucide-react";

const task = TASKS.find((each) => each.id === 6);

export function CopyInPlace() {
  return (
    <div className="flex max-w-md items-center gap-2 text-ui">
      <span className="text-muted-foreground tabular-nums">T-{task?.id}</span>
      <span className="flex-1 truncate font-medium">{task?.title}</span>
      <CopyButton
        text={`https://app.example/tasks/${task?.id}`}
        icon={<LinkIcon />}
        copiedLabel="Link copied"
      >
        Copy link
      </CopyButton>
    </div>
  );
}
