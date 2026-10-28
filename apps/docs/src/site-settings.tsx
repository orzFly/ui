import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import { setShortcutsEnabled, useShortcutsEnabled } from "./shortcuts.ts";

/** The Settings page's switch for the site's single-key shortcuts. */
export function CharacterKeysSetting() {
  const enabled = useShortcutsEnabled();
  return (
    <div className="mb-5 flex items-center justify-between gap-4 border-b py-3">
      <div className="grid gap-1">
        <Label htmlFor="settings-character-keys">Character keys</Label>
        <p
          id="settings-character-keys-description"
          className="text-muted-foreground text-sm"
        >
          Press <kbd className="font-mono">/</kbd> to search the docs. Turn it
          off if a key you did not mean to press — from speech input, say —
          keeps landing you in the search box.
        </p>
      </div>
      <Switch
        id="settings-character-keys"
        checked={enabled}
        onCheckedChange={setShortcutsEnabled}
        aria-describedby="settings-character-keys-description"
      />
    </div>
  );
}
