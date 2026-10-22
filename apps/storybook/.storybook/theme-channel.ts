import type { ThemePreview } from "@orz/ui/theme";

/** A hover preview, mirrored between the manager's store and the preview's. */
export const PREVIEW_EVENT = "orz/theme-preview";

export interface PreviewMessage {
  // Storybook's Channel.emit also runs the sender's own listeners, so each
  // side skips the messages it sent itself by this.
  from: "manager" | "preview";
  /** null shows the committed theme again. */
  preview: ThemePreview | null;
  /**
   * The toolbar editor's draft, which outlasts a commit and the end of a
   * hover; its null ends it. Each side re-shows it itself, because a resend
   * can reach the manager ahead of the globals change that cleared it.
   */
  draft?: true;
}

/** The toolbar's ThemeMenu asking the preview to open its ThemeEditor. */
export const CUSTOMIZE_EVENT = "orz/theme-customize";

/** `ThemeMenu`'s `onCustomize(id, slot)` as one message. */
export interface CustomizeMessage {
  /** The custom theme to edit; undefined starts a new one. */
  id: string | undefined;
  slot: "ui" | "terminal";
}
