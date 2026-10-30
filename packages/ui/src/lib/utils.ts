import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The style tokens' utilities (theme.css), named to tailwind-merge so a
// caller's `rounded-none` replaces `rounded-control` and `text-ui-sm` is not
// taken for a colour.
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
      ],
      radius: ["control", "item", "frame", "surface", "overlay", "chip"],
      text: ["ui-sm", "ui-xs", "ui-2xs", "ui-3xs", "data", "title"],
      font: ["ui"],
      shadow: ["raised", "menu", "overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
