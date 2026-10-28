import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

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
        <section key={group.title} className="divide-y rounded-lg border">
          <h4 className="px-3 py-1.5 font-medium text-muted-foreground text-xs">
            {group.title}
          </h4>
          {group.settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between gap-4 px-3 py-1.5"
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
