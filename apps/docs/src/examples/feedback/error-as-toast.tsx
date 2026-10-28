import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { toast } from "sonner";

export function ErrorAsToast() {
  return (
    <form
      className="grid gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        toast.error("Couldn't save the profile");
      }}
    >
      <Label htmlFor="dont-email">Email</Label>
      <Input id="dont-email" type="email" defaultValue="alice@example" />
      <Button type="submit" className="justify-self-end">
        Save profile
      </Button>
    </form>
  );
}
