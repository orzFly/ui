import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

const GROUPS = [
  {
    title: "Editor",
    settings: [
      { id: "spaced-wrap", label: "Wrap long lines", on: true },
      { id: "spaced-line-numbers", label: "Show line numbers", on: true },
    ],
  },
  {
    title: "Send them by",
    settings: [
      { id: "spaced-email", label: "Email", on: true },
      { id: "spaced-desktop", label: "Desktop notifications", on: false },
    ],
  },
];

export function SpacedGroups() {
  return (
    <div className="grid gap-6">
      {GROUPS.map((group) => (
        <section key={group.title} className="grid gap-3">
          <h4 className="font-medium text-muted-foreground text-ui-sm">
            {group.title}
          </h4>
          {group.settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between gap-4"
            >
              <Label htmlFor={setting.id}>{setting.label}</Label>
              <Switch id={setting.id} defaultChecked={setting.on} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
