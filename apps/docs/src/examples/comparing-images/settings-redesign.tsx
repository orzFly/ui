import { SETTINGS_PAIR } from "@orz/fixtures/files.ts";
import {
  AttachmentViewer,
  type AttachmentViewerState,
} from "@orz/ui-content/attachment";
import { MediaCompare } from "@orz/ui-content/compare";
import { useState } from "react";

export function SettingsRedesign() {
  const [viewer, setViewer] = useState<AttachmentViewerState | null>(null);
  const { before, after } = SETTINGS_PAIR;
  return (
    <>
      <MediaCompare
        before={{
          label: "Before",
          content: <img src={before.file.url} alt="Settings, before" />,
          size: before.size,
        }}
        after={{
          label: "After",
          content: <img src={after.file.url} alt="Settings, after" />,
          size: after.size,
        }}
        onOpen={() =>
          setViewer({
            compare: [
              {
                before: { label: "Before", ...before },
                after: { label: "After", ...after },
              },
            ],
            index: 0,
          })
        }
      />
      <AttachmentViewer
        state={viewer}
        onNavigate={(index) => setViewer((s) => s && { ...s, index })}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
