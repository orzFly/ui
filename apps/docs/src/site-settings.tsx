import { Label } from "@orz/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import { Switch } from "@orz/ui/components/switch";
import { useStyle } from "@orz/ui/theme";
import { useHydrated } from "./hydrated.tsx";
import { setShortcutsEnabled, useShortcutsEnabled } from "./shortcuts.ts";

/**
 * The Settings page's style picker; nothing while the site offers one style.
 * The styles are the browser store's, so the prerendered page has none.
 */
export function StyleSetting() {
  const { committed, styles, setStyle } = useStyle();
  const hydrated = useHydrated();
  if (!hydrated || styles.length < 2) return null;
  return (
    <div className="mb-5 grid gap-3 border-b py-3">
      <div className="grid gap-1">
        <Label id="settings-style">Style</Label>
        <p
          id="settings-style-description"
          className="text-muted-foreground text-sm"
        >
          How every part of the site is drawn: its corners, edges, type and
          spacing. Each style has its own themes, in the top bar's menu.
        </p>
      </div>
      <RadioGroup
        aria-labelledby="settings-style"
        aria-describedby="settings-style-description"
        value={committed}
        onValueChange={setStyle}
      >
        {styles.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <RadioGroupItem value={id} id={`settings-style-${id}`} />
            <Label htmlFor={`settings-style-${id}`}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

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
          Press <kbd className="font-mono">/</kbd> to search the docs, and
          single keys such as <kbd className="font-mono">E</kbd> to archive in
          the Mail demo. Turn them off if keys you did not mean to press — from
          speech input, say — keep acting.
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
