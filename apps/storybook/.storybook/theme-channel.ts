import type { ThemePreview } from "@orz/ui/theme";

/** A hover preview, mirrored between the manager's store and the preview's. */
export const PREVIEW_EVENT = "orz/theme-preview";

export interface PreviewMessage {
  // Storybook's Channel.emit also runs the sender's own listeners, so each
  // side skips the messages it sent itself by this.
  from: "manager" | "preview";
  /** null shows the committed theme again. */
  preview: ThemePreview | null;
}
