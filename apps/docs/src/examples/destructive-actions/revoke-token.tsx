import { type AccessToken, TOKENS } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { EmptyState } from "@orz/ui/components/empty-state";
import { List, ListItem } from "@orz/ui/components/list";
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
      <List purpose="collection">
        {tokens.length > 0 ? (
          <ul>
            {tokens.map((token) => (
              <ListItem key={token.id} asChild>
                <li className="flex min-h-row items-center gap-3 py-3">
                  <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium font-mono text-ui">
                      {token.name}
                    </span>
                    <span className="text-muted-foreground text-ui-sm">
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
              </ListItem>
            ))}
          </ul>
        ) : (
          <EmptyState title="No access tokens" className="py-3">
            Scripts and bots that need one get it from the command line.
          </EmptyState>
        )}
      </List>
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
