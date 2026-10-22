import type { ComponentType } from "react";

export type ContentSource =
  | { kind: "inline"; text: string; lang?: string }
  | {
      kind: "file";
      name: string;
      mime?: string;
      size?: number;
      /** Where the bytes live; what an <img>, an <iframe> or the download link uses. */
      url?: string;
      /** The text, for renderers that need it; useSourceText falls back to fetching url. */
      load?: (signal: AbortSignal) => Promise<string>;
    };

/** "document": inside a flow of other content (a fence, an embed). "viewer": owns the surface. */
export type Placement = "document" | "viewer";

export type ContentProps = {
  source: ContentSource;
  placement: Placement;
  /**
   * Put on the renderer's root element. Decoration passes mark the element a source was
   * written as (an embedded <img>), and the class has to survive the swap to a renderer.
   */
  className?: string;
};

export type ContentDisplay = "block" | "inline";

export type ContentRenderer = {
  name: string;
  /**
   * Synchronous and pure: decided from the descriptor alone. Layout decisions upstream
   * (a paragraph becoming a <div>) are made from it during render and must not flip
   * when data arrives later.
   */
  accepts(source: ContentSource, placement: Placement): boolean;
  /** "block" content cannot sit inside a <p>. Default "block". */
  display?: ContentDisplay;
  /** `Next` draws the same source with the renderers after this one. */
  Component: ComponentType<
    ContentProps & { Next: ComponentType<ContentProps> }
  >;
};
