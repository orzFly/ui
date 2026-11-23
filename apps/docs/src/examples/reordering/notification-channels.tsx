import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { List, ListItem } from "@orz/ui/components/list";
import {
  moveItem,
  Reorder,
  ReorderButtons,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import { EllipsisIcon } from "lucide-react";
import { useState } from "react";

const CHANNELS = [
  { id: "push", name: "Push to phone", detail: "2 devices" },
  { id: "email", name: "Email", detail: "alice@example.com" },
  { id: "chat", name: "Chat webhook", detail: "hooks.example" },
  { id: "sms", name: "SMS", detail: "+1 555 0100" },
  { id: "desktop", name: "Desktop notification", detail: "This browser" },
];

export function NotificationChannels() {
  const [channels, setChannels] = useState(CHANNELS);
  return (
    <List purpose="collection" framed className="max-w-lg">
      <Reorder
        items={channels.map((c) => c.id)}
        onMove={(move) => setChannels((cs) => moveItem(cs, move))}
        asChild
      >
        <ul>
          {channels.map((channel) => (
            <ListItem key={channel.id} asChild>
              <ReorderItem id={channel.id} name={channel.name} asChild>
                <li className="flex min-h-row items-center gap-2 pr-1">
                  <ReorderHandle />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="truncate">{channel.name}</span>
                    <span className="truncate text-ui-sm text-muted-foreground">
                      {channel.detail}
                    </span>
                  </span>
                  <ReorderButtons />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`More actions for ${channel.name}`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit…</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive">
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              </ReorderItem>
            </ListItem>
          ))}
        </ul>
      </Reorder>
    </List>
  );
}
