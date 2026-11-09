import { PROFILE } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { NavList, NavListItem, NavListLink } from "@orz/ui/components/nav-list";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function LeaveWithUnsavedChanges() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(PROFILE.name);
  const [name, setName] = useState(PROFILE.name);
  const [asking, setAsking] = useState(false);
  const leave = () => {
    setName(saved);
    setOpen(false);
  };

  if (!open) {
    return (
      <nav aria-label="Settings">
        <NavList>
          <NavListItem>
            <NavListLink asChild>
              <button type="button" onClick={() => setOpen(true)}>
                Profile
                <ChevronRightIcon className="ml-auto" />
              </button>
            </NavListLink>
          </NavListItem>
        </NavList>
      </nav>
    );
  }
  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(name);
        toast.success("Profile saved");
      }}
    >
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 justify-self-start"
        onClick={() => (name === saved ? leave() : setAsking(true))}
      >
        <ChevronLeftIcon />
        Settings
      </Button>
      <div className="grid gap-2">
        <Label htmlFor="leave-name">Display name</Label>
        <Input
          id="leave-name"
          autoComplete="nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button type="submit" className="justify-self-end">
        Save profile
      </Button>
      <UnsavedChangesDialog
        open={asking}
        onStay={() => setAsking(false)}
        onProceed={() => {
          setAsking(false);
          leave();
        }}
      />
    </form>
  );
}
