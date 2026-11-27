import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The style tokens' utilities (theme.css), named to tailwind-merge so a
// caller's `rounded-none` replaces `rounded-control`, a caller's `p-0` a
// part's `p-module`, a caller's `touch:min-h-0` a part's `touch:min-h-touch`,
// and `text-ui-sm` or `text-prose-sm` is not taken for a colour. Unnamed, a
// token goes wrong quietly: `p-module` stays beside the caller's `p-0` and
// wins by stylesheet order, and `text-prose-sm` is dropped as a colour beside
// `text-muted-foreground`. test/utils.test.ts reads every token in theme.css
// and fails on one this list leaves out.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        "control-xs",
        "control-sm",
        "control",
        "control-lg",
        "row",
        "row-head",
        "row-dense",
        "chip",
        "module",
        "hit-xs",
        "hit-sm",
        "hit",
        "hit-lg",
        "touch",
        "field-touch",
      ],
      radius: ["control", "item", "frame", "surface", "overlay", "chip"],
      text: [
        "ui",
        "ui-sm",
        "ui-xs",
        "ui-2xs",
        "ui-3xs",
        "data",
        "title",
        "prose",
        "prose-sm",
        "prose-xs",
        "prose-lg",
        "heading-3",
        "heading-2",
        "heading-1",
        "heading-1-wide",
        "display",
        "display-wide",
      ],
      leading: ["prose", "prose-sm"],
      font: ["ui"],
      shadow: ["raised", "sunken", "pressed", "menu", "overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
