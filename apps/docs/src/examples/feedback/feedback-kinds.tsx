import { PROFILE } from "@orz/fixtures/account.ts";
import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import { FieldDescription, FieldError } from "@orz/ui/components/field";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { List, ListItem } from "@orz/ui/components/list";
import { RefreshFailure } from "@orz/ui/components/load-failure";
import { LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const check = (email: string) =>
  /^\S+@\S+\.\S+$/.test(email)
    ? undefined
    : `Enter an email address, like ${PROFILE.email}.`;

export function FeedbackKinds() {
  const [email, setEmail] = useState("alice@example");
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const [stale, setStale] = useState(true);
  return (
    <div className="grid gap-8">
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => toast("Link copied")}
      >
        <LinkIcon />
        Copy link
      </Button>
      <form
        className="grid max-w-md gap-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const problem = check(email);
          setError(problem);
          if (!problem) toast.success("Profile saved");
        }}
      >
        <Label htmlFor="fb-email">Email</Label>
        <div className="flex gap-2">
          <Input
            id="fb-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(check(event.target.value));
            }}
            aria-invalid={error !== undefined}
            aria-describedby={error ? "fb-email-error" : "fb-email-hint"}
          />
          <Button type="submit">Save profile</Button>
        </div>
        {error ? (
          <FieldError id="fb-email-error">{error}</FieldError>
        ) : (
          <FieldDescription id="fb-email-hint">
            Notifications go here.
          </FieldDescription>
        )}
      </form>
      <div className="grid gap-2">
        {stale && (
          <RefreshFailure
            what="the checks"
            detail="503 Service Unavailable"
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => {
                setRetrying(false);
                setStale(false);
              }, 800);
            }}
          />
        )}
        <List purpose="collection">
          <ul className="text-ui">
            {CI_RUN.jobs.map((job) => (
              <ListItem key={job.id} asChild>
                <li className="flex min-h-row items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {CI_RUN.workflow} / {job.name}
                  </span>
                  <span className="text-muted-foreground">{job.status}</span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </div>
    </div>
  );
}
