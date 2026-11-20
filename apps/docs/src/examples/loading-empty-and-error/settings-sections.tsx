import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { EmptyState } from "@orz/ui/components/empty-state";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { KeyRoundIcon, LockIcon, PlusIcon, WebhookIcon } from "lucide-react";
import { useState } from "react";

export function SettingsSections() {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Deploy keys</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            orientation="horizontal"
            icon={LockIcon}
            title="Only maintainers see deploy keys"
            action={
              <Button variant="outline" size="sm">
                Request access
              </Button>
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            orientation="horizontal"
            icon={KeyRoundIcon}
            title="No tokens yet"
            action={
              <Button variant="outline" size="sm">
                <PlusIcon />
                New token
              </Button>
            }
          >
            A token lets a script act as you.
          </EmptyState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadFailure
            orientation="horizontal"
            icon={WebhookIcon}
            message="Couldn't load webhooks"
            detail="503 Service Unavailable"
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => setRetrying(false), 1000);
            }}
            retrying={retrying}
          />
        </CardContent>
      </Card>
    </div>
  );
}
