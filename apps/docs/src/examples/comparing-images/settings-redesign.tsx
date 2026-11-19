import { SETTINGS_PAIR } from "@orz/fixtures/files.ts";
import { MediaCompare } from "@orz/ui-content/compare";

export function SettingsRedesign() {
  return (
    <MediaCompare
      before={{
        label: "Before",
        content: (
          <img src={SETTINGS_PAIR.before.file.url} alt="Settings, before" />
        ),
        size: SETTINGS_PAIR.before.size,
      }}
      after={{
        label: "After",
        content: (
          <img src={SETTINGS_PAIR.after.file.url} alt="Settings, after" />
        ),
        size: SETTINGS_PAIR.after.size,
      }}
    />
  );
}
