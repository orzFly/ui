import { Button } from "@orz/ui/components/button";
import { NotebookIcon, PlusIcon } from "lucide-react";

export function EmptyWithNextStep() {
  return (
    <div className="grid justify-items-center gap-2 text-center">
      <NotebookIcon className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">No notes yet</p>
      <p className="text-muted-foreground text-ui">
        A note is markdown, kept in this tab. Start one with a # heading.
      </p>
      <Button variant="outline" size="sm" className="mt-1">
        <PlusIcon />
        New note
      </Button>
    </div>
  );
}
