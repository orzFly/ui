import { TASK_LABELS, TASK_PEOPLE } from "@orz/fixtures/tasks.ts";
import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orz/ui/components/dialog";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { useState } from "react";

export interface NewTask {
  title: string;
  assignee: string | null;
  label: string | null;
}

const NONE = "none";

/**
 * A task's title, and optionally who has it and a label. Mounted afresh each time it opens, so a
 * cancelled task leaves nothing behind for the next.
 */
export function NewTaskDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (task: NewTask) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            It starts as To do, at the top of the list.
          </DialogDescription>
        </DialogHeader>
        {open && <NewTaskForm onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
}

function NewTaskForm({ onCreate }: { onCreate: (task: NewTask) => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(NONE);
  const [label, setLabel] = useState(NONE);
  const [error, setError] = useState(false);
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") {
          setError(true);
          event.currentTarget.querySelector("input")?.focus();
          return;
        }
        onCreate({
          title: title.trim(),
          assignee: assignee === NONE ? null : assignee,
          label: label === NONE ? null : label,
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="new-task-title">Title</Label>
        <Input
          id="new-task-title"
          autoComplete="off"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(event.target.value.trim() === "");
          }}
          aria-invalid={error}
          aria-describedby={error ? "new-task-title-error" : undefined}
        />
        {error && (
          <p id="new-task-title-error" className="text-destructive text-ui">
            Give the task a title.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="new-task-assignee">Assignee</Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger id="new-task-assignee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nobody</SelectItem>
              {TASK_PEOPLE.map(({ login, name }) => (
                <SelectItem key={login} value={login}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-task-label">Label</Label>
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger id="new-task-label" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {TASK_LABELS.map((each) => (
                <SelectItem key={each} value={each}>
                  {each}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">Create task</Button>
      </DialogFooter>
    </form>
  );
}
