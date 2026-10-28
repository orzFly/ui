import { type AccessToken, TOKENS } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function RevokeToken() {
  const [tokens, setTokens] = useState(TOKENS);
  const [revoking, setRevoking] = useState<AccessToken>();
  // Kept apart from `revoking` so the dialog keeps its title while it fades out.
  const [open, setOpen] = useState(false);
  return (
    <div className="grid">
      <ul className="divide-y">
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center gap-3 py-3">
            <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-medium font-mono text-sm">
                {token.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {token.scopes} · {token.lastUsed}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              aria-label={`Revoke ${token.name}`}
              onClick={() => {
                setRevoking(token);
                setOpen(true);
              }}
            >
              Revoke…
            </Button>
          </li>
        ))}
      </ul>
      {tokens.length === 0 && (
        <p className="py-3 text-muted-foreground text-sm">
          No access tokens. Scripts and bots that need one get it from the
          command line.
        </p>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Revoke the token for ${revoking?.name}?`}
        description="Anything that signs in with it stops working at once. A revoked token cannot be restored: you would create a new one and update everything that used the old."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          setTokens((list) => list.filter((each) => each !== revoking));
          setOpen(false);
          toast(`Revoked the token for ${revoking?.name}`);
        }}
      />
    </div>
  );
}
