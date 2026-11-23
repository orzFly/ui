import { List, ListItem, ListLabel } from "@orz/ui/components/list";
import {
  moveInGroups,
  Reorder,
  ReorderButtons,
  ReorderGroup,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import { useState } from "react";

const NAMES: Record<string, string> = {
  push: "Push to phone",
  email: "Email",
  chat: "Chat webhook",
  sms: "SMS",
  desktop: "Desktop notification",
};

const TIERS = [
  { id: "first", name: "Notify first", items: ["push", "email"] },
  {
    id: "fallback",
    name: "If nobody answers",
    items: ["chat", "sms", "desktop"],
  },
  { id: "paused", name: "Paused", items: [] as string[] },
];

export function ChannelTiers() {
  const [tiers, setTiers] = useState(TIERS);
  return (
    <List purpose="collection" framed className="max-w-lg">
      <Reorder
        groups={tiers}
        onMove={(move) => setTiers((ts) => moveInGroups(ts, move))}
        // "Notify first" takes at most two channels.
        canDrop={(id, to) =>
          to.group !== "first" ||
          tiers[0].items.filter((i) => i !== id).length < 2
        }
      >
        {tiers.map((tier) => (
          <ReorderGroup key={tier.id} id={tier.id} name={tier.name} asChild>
            <section>
              <ListLabel asChild>
                <h3 className="px-2.5 pt-2 pb-1">{tier.name}</h3>
              </ListLabel>
              {tier.items.length === 0 && (
                <p className="px-2.5 pb-2 text-ui-sm text-muted-foreground">
                  No channels
                </p>
              )}
              <ul>
                {tier.items.map((id) => (
                  <ListItem key={id} asChild>
                    <ReorderItem id={id} name={NAMES[id]} asChild>
                      <li className="flex min-h-row items-center gap-2 pr-1 touch:pr-hit-xs">
                        <ReorderHandle />
                        <span className="min-w-0 flex-1 truncate">
                          {NAMES[id]}
                        </span>
                        <ReorderButtons />
                      </li>
                    </ReorderItem>
                  </ListItem>
                ))}
              </ul>
            </section>
          </ReorderGroup>
        ))}
      </Reorder>
    </List>
  );
}
