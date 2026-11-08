import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      // Under raymond a disabled control's label is embossed grey, not faded.
      className={cn(
        "flex items-center gap-2 text-ui leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 raymond:group-data-[disabled=true]:opacity-100 raymond:group-data-[disabled=true]:text-(--3d-shadow) raymond:group-data-[disabled=true]:[text-shadow:1px_1px_var(--3d-highlight)] raymond:peer-disabled:opacity-100 raymond:peer-disabled:text-(--3d-shadow) raymond:peer-disabled:[text-shadow:1px_1px_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
