import { InfoIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

/**
 * An (i) button that opens a line or two of explanation in a popover. Put it right after the label
 * or title it explains; `children` is the explanation, which may hold a link.
 *
 * `label` names the button for a screen reader, "More information" when left out; name what it
 * explains ("About format on save") when a view holds several. `side` and `align` place the
 * popover; `className` goes on the popover.
 */
function InfoPopover({
  label = "More information",
  side = "top",
  align = "start",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Popover>, "children"> & {
  label?: string;
  side?: React.ComponentProps<typeof PopoverContent>["side"];
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover {...props}>
      <PopoverTrigger asChild>
        <Button
          data-slot="info-popover-trigger"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          // With a pointer the negative margin keeps the button from making a
          // label's line taller than the label beside it in the next field.
          // On touch it keeps the rest of its hit area above and below it
          // instead, so the line it stands on is the touch spacing tall and
          // the control under it shares no tap. Unlike other icon buttons it
          // reserves no room beside it: it stands after the text it
          // explains, which takes no tap, and the room would only push the
          // label's words apart.
          className="-my-1 mx-0 text-muted-foreground hover:text-foreground aria-expanded:text-foreground touch:my-hit-xs"
        >
          <InfoIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="info-popover-content"
        side={side}
        align={align}
        className={cn("p-3 text-ui", className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export { InfoPopover };
