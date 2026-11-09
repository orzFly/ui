import { Card } from "@orz/ui/components/card";
import { GroupHeading } from "@orz/ui/components/group-heading";
import { Label } from "@orz/ui/components/label";
import { Separator } from "@orz/ui/components/separator";
import { Switch } from "@orz/ui/components/switch";
import { Fragment } from "react";

const GROUPS = [
  {
    title: "Editor",
    settings: [
      { id: "boxed-wrap", label: "Wrap long lines", on: true },
      { id: "boxed-line-numbers", label: "Show line numbers", on: true },
    ],
  },
  {
    title: "Send them by",
    settings: [
      { id: "boxed-email", label: "Email", on: true },
      { id: "boxed-desktop", label: "Desktop notifications", on: false },
    ],
  },
];

export function BoxedGroups() {
  return (
    <div className="grid gap-2">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <Card className="gap-0 py-0">
            <GroupHeading asChild className="px-3 py-1.5">
              <h4>{group.title}</h4>
            </GroupHeading>
            {group.settings.map((setting) => (
              <Fragment key={setting.id}>
                <Separator purpose="group" />
                <div className="flex items-center justify-between gap-4 px-3 py-1.5">
                  <Label htmlFor={setting.id}>{setting.label}</Label>
                  <Switch id={setting.id} defaultChecked={setting.on} />
                </div>
              </Fragment>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
