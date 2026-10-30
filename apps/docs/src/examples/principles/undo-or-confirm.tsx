import { type AccessToken, TOKENS } from "@orz/fixtures/account.ts";
import { INBOX_THREADS, type InboxThread } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const THREAD = INBOX_THREADS.find(
  (thread) => thread.id === "release-0-9",
) as InboxThread;
const TOKEN = TOKENS[0] as AccessToken;

export function UndoOrConfirm() {
  const [archived, setArchived] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-2 text-ui">
      <div className="flex min-h-9 items-center gap-2">
        <MailIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {THREAD.subject}
          {archived && (
            <span className="text-muted-foreground"> · Archived</span>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={archived}
          onClick={() => {
            setArchived(true);
            toast("Conversation archived", {
              action: { label: "Undo", onClick: () => setArchived(false) },
            });
          }}
        >
          Archive
        </Button>
      </div>
      <div className="flex min-h-9 items-center gap-2">
        <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-mono">{TOKEN.name}</span>
          {revoked && <span className="text-muted-foreground"> · Revoked</span>}
        </span>
        <Button
          variant="destructive"
          size="sm"
          disabled={revoked}
          aria-label={`Revoke ${TOKEN.name}`}
          onClick={() => setConfirming(true)}
        >
          Revoke…
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Revoke the token for ${TOKEN.name}?`}
        description="Anything that signs in with it stops working at once. A revoked token cannot be restored: you would create a new one and update everything that used the old."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          setRevoked(true);
          setConfirming(false);
          toast(`Revoked the token for ${TOKEN.name}`);
        }}
      />
    </div>
  );
}
