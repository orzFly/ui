import { defaultStyle, raymondStyle, type Style } from "@orz/themes";

/**
 * The styles every theme store here offers: the toolbar's, the canvas's and a
 * pinned story's. A style other than the default needs its stylesheet in
 * preview.css too.
 */
export const STYLES: readonly Style[] = [defaultStyle, raymondStyle];
