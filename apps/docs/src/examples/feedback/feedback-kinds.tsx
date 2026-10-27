import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { RefreshFailure } from "@orz/ui/components/load-failure";
import { useState } from "react";
import { toast } from "sonner";

export function FeedbackKinds() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(true);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => toast("Link copied")}>
          Copy link
        </Button>
        <span className="text-muted-foreground text-sm">
          Done, and nothing to do next: a toast.
        </span>
      </div>
      <form
        className="grid max-w-sm gap-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === "") {
            setError("Enter a name for the project.");
            return;
          }
          setError(undefined);
          toast.success(`Renamed to ${name.trim()}`);
        }}
      >
        <Label htmlFor="fb-name">Project name</Label>
        <div className="flex gap-2">
          <Input
            id="fb-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={error !== undefined}
            aria-describedby={error ? "fb-name-error" : undefined}
          />
          <Button type="submit">Rename</Button>
        </div>
        {error && (
          <p id="fb-name-error" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </form>
      {failed ? (
        <RefreshFailure
          what="the run list"
          detail="503 Service Unavailable"
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            setTimeout(() => {
              setRetrying(false);
              setFailed(false);
            }, 800);
          }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Run list up to date.</p>
      )}
    </div>
  );
}
