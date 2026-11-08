import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/utils.ts";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  trackChildren,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Drawn inside the track, under the range: a media bar's buffered ranges. */
  trackChildren?: React.ReactNode;
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    // Under touch the whole bar takes a tap, through a 44px ::after kept under
    // the thumb: a press on the thumb grabs it rather than jumping the value
    // to where the finger landed.
    // Under raymond it is a trackbar: a sunken channel with nothing filled
    // along it, and a raised upright thumb on the face; its focus rectangle
    // goes round the whole bar.
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col touch:isolate touch:hit-area touch:after:-z-10 raymond:has-focus-visible:focus-ring",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 raymond:rounded-none raymond:bg-transparent raymond:shadow-sunken"
      >
        {trackChildren}
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full raymond:bg-transparent"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          // The thumb is what carries role="slider"; named on the root, it
          // would be announced without a name.
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are positional, one per value
          key={index}
          className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 outline-none hover:ring-3 focus-visible:focus-ring active:ring-3 disabled:pointer-events-none disabled:opacity-50 touch:hit-area raymond:h-5 raymond:w-2.75 raymond:focus-visible:outline-none raymond:rounded-none raymond:border-0 raymond:bg-(--3d-face) raymond:shadow-raised raymond:ring-0 raymond:data-vertical:h-2.75 raymond:data-vertical:w-5"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
