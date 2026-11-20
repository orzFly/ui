import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { EmptyState } from "@orz/ui/components/empty-state";
import { KeyRoundIcon, LockIcon, PlusIcon, WebhookIcon } from "lucide-react";

export function SettingsSections() {
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
          <EmptyState
            orientation="horizontal"
            tone="destructive"
            icon={WebhookIcon}
            title="Couldn't load webhooks"
            action={
              <Button variant="outline" size="sm">
                Retry
              </Button>
            }
          >
            503 Service Unavailable
          </EmptyState>
        </CardContent>
      </Card>
    </div>
  );
}
