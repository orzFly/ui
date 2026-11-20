import { createContext, useContext } from "react";
import type { ImageLook } from "./image-look.ts";
import type { Widening } from "./use-zoom-pan.ts";

/** What a zoom canvas needs from the viewer around it. */
export type ViewerImage = {
  /** Whether the dialog fills the window. */
  maximized: boolean;
  look: ImageLook;
  setLook(look: ImageLook): void;
  /** The last canvas height, so the next one tweens from it. */
  lastHeight: { current: number | null };
  /** The height the canvas keeps while the pointer is on the title-bar controls. */
  held: number | null;
  /** The dialog a zoomed canvas widens. */
  dialog: HTMLElement | null;
  /** What the canvas asked of the dialog's width, so the next one pages in from it. */
  widening: { current: Widening };
  /** How many canvases are mounted: with none, the viewer gives the width back. */
  canvases: { current: number };
};

export const ViewerImageContext = createContext<ViewerImage | null>(null);

/** What a renderer's zoom canvas needs from the viewer around it; null outside one. */
export function useViewerImage(): ViewerImage | null {
  return useContext(ViewerImageContext);
}
