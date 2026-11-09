import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import { NotebookIcon, PlusIcon } from "lucide-react";

export function EmptyWithNextStep() {
  return (
    <EmptyState
      icon={NotebookIcon}
      title="No notes yet"
      action={
        <Button variant="outline" size="sm">
          <PlusIcon />
          New note
        </Button>
      }
    >
      A note is markdown, kept in this tab. Start one with a # heading.
    </EmptyState>
  );
}
