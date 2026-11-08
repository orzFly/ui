import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * Turns a setting on or off, taking effect the moment it flips.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Windows 2000 has no switch: under raymond it is drawn as a check box,
        // a sunken white square with a check while on, grey while held down or
        // disabled.
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-raised transition-all outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input touch:hit-area raymond:size-3.25 raymond:rounded-none raymond:border-0 raymond:bg-(--window) raymond:bg-clip-padding raymond:bg-center raymond:bg-no-repeat raymond:shadow-sunken raymond:[--focus-offset:1px] raymond:[--input:var(--window)] raymond:[--primary:var(--window)] raymond:active:bg-(--3d-face) raymond:disabled:bg-(--3d-face) raymond:disabled:opacity-100 raymond:data-[state=checked]:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%277%27%20height=%277%27%3E%3Cpath%20d=%27M6%200h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z%27/%3E%3C/svg%3E')]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%+2px)] data-[state=unchecked]:translate-x-0.5 raymond:hidden",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
