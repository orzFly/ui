import {
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.ts";

/** Before a held step button starts repeating, and then between repeats. */
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 50;

function decimalsOf(n: number) {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * A number typed or stepped, with step buttons on its trailing edge: a count,
 * a port, a font size. The arrow keys step it, Page Up and Page Down step it
 * by `largeStep`, Home and End go to `min` and `max`. Typed text is kept as
 * typed until Enter or the field loses focus, then held to the range and the
 * step; text that is no number puts the value back. `value` with
 * `onValueChange` controls it, `defaultValue` leaves it to itself. `className`
 * places the whole box; every other prop goes to the field.
 */
function NumberInput({
  value: controlled,
  defaultValue,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep = step * 10,
  className,
  disabled,
  readOnly,
  onKeyDown,
  onBlur,
  ref,
  ...props
}: Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "type" | "min" | "max" | "step" | "onChange"
> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** What one press of a step button or an arrow key adds; values snap to it from `min`. */
  step?: number;
  /** What Page Up and Page Down add; ten steps unless set. */
  largeStep?: number;
}) {
  const [own, setOwn] = React.useState(defaultValue ?? min ?? 0);
  const value = controlled ?? own;
  // What the field shows while it is being typed in; null shows the value.
  const [text, setText] = React.useState<string | null>(null);
  const field = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => field.current as HTMLInputElement);

  const snap = (n: number) => {
    const base = min ?? 0;
    const snapped = base + Math.round((n - base) / step) * step;
    const fixed = Number(
      snapped.toFixed(Math.max(decimalsOf(step), decimalsOf(base))),
    );
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, fixed));
  };
  // The value as last set, ahead of the render that shows it: a held step
  // button's repeats can outrun React's renders.
  const latest = React.useRef(value);
  latest.current = value;
  const set = (next: number) => {
    setText(null);
    if (next === latest.current) return;
    latest.current = next;
    setOwn(next);
    onValueChange?.(next);
  };
  /** The value typed so far, or the value when nothing typed is a number. */
  const current = () => {
    if (text === null || text.trim() === "") return value;
    const typed = Number(text);
    return Number.isFinite(typed) ? snap(typed) : value;
  };
  const stepBy = (delta: number) => set(snap(current() + delta));
  const repeatRef = React.useRef(stepBy);
  repeatRef.current = (delta: number) => set(snap(latest.current + delta));
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopRepeat = React.useCallback(() => clearTimeout(timer.current), []);
  React.useEffect(() => stopRepeat, [stopRepeat]);
  const atMax = max !== undefined && value >= max;
  const atMin = min !== undefined && value <= min;
  React.useEffect(() => {
    if (atMax || atMin) stopRepeat();
  }, [atMax, atMin, stopRepeat]);

  const stepButton = (direction: 1 | -1) => {
    const off = disabled || readOnly || (direction > 0 ? atMax : atMin);
    return (
      <button
        type="button"
        data-slot="number-input-step"
        // The field keeps the focus, and the arrow keys are the way in
        // without a pointer.
        tabIndex={-1}
        aria-label={direction > 0 ? "Increase" : "Decrease"}
        disabled={off}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          field.current?.focus();
          stepBy(direction * step);
          const repeat = (delay: number) => {
            timer.current = setTimeout(() => {
              repeatRef.current(direction * step);
              repeat(REPEAT_INTERVAL);
            }, delay);
          };
          repeat(REPEAT_DELAY);
        }}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        // A click with no pointer behind it, from assistive technology; a
        // pointer's own click already stepped on pointerdown.
        onClick={(event) => {
          if (event.detail === 0) stepBy(direction * step);
        }}
        // Under raymond each is a raised half of an up-down control, its
        // arrow a small black triangle that moves a pixel while held, and
        // embossed grey when it can go no further.
        className={cn(
          "relative flex w-6 flex-1 items-center justify-center text-muted-foreground outline-none transition-colors enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 touch:w-10",
          "raymond:w-4 raymond:bg-(--3d-face) raymond:text-foreground raymond:shadow-raised raymond:transition-none raymond:enabled:hover:bg-(--3d-face) raymond:enabled:active:shadow-[inset_0_0_0_1px_var(--3d-shadow)] raymond:enabled:active:[&_svg]:translate-px raymond:disabled:opacity-100 raymond:disabled:text-(--3d-shadow) raymond:disabled:[&_svg]:drop-shadow-[1px_1px_0_var(--3d-highlight)] raymond:touch:w-10",
        )}
      >
        {direction > 0 ? (
          <ChevronUpIcon className="size-3 touch:hidden raymond:hidden" />
        ) : (
          <ChevronDownIcon className="size-3 touch:hidden raymond:hidden" />
        )}
        {direction > 0 ? (
          <PlusIcon className="hidden size-4 touch:block raymond:hidden" />
        ) : (
          <MinusIcon className="hidden size-4 touch:block raymond:hidden" />
        )}
        <svg
          aria-hidden
          viewBox="0 0 5 3"
          className="hidden h-0.75 w-1.25 fill-current [shape-rendering:crispEdges] raymond:block"
        >
          <path
            d={
              direction > 0
                ? "M2 0h1v1h1v1h1v1H0V2h1V1h1z"
                : "M0 0h5v1H4v1H3v1H2V2H1V1H0z"
            }
          />
        </svg>
      </button>
    );
  };

  return (
    <div
      data-slot="number-input"
      // Under raymond the field is sunken on the window colour, as Input's,
      // with the up-down control inside its bevel; its focus rectangle goes
      // round the text alone.
      className={cn(
        "flex h-control w-full min-w-0 overflow-hidden rounded-control border border-input bg-field text-base transition-colors has-[input:focus-visible]:focus-ring has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-input/10 has-[input:disabled]:opacity-50 md:text-ui dark:bg-input/15 dark:has-[input:disabled]:bg-input/40 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40 touch:h-10 touch:text-base",
        "raymond:border-transparent raymond:bg-(--window) raymond:bg-clip-padding raymond:shadow-sunken raymond:has-[input:focus-visible]:outline-none raymond:has-aria-invalid:ring-0 raymond:has-[input:disabled]:bg-(--3d-face) raymond:has-[input:disabled]:opacity-100",
        className,
      )}
    >
      <input
        ref={field}
        type="text"
        role="spinbutton"
        inputMode={
          Number.isInteger(step) && (min ?? 0) >= 0 ? "numeric" : "decimal"
        }
        autoComplete="off"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        data-slot="number-input-field"
        disabled={disabled}
        readOnly={readOnly}
        value={text ?? String(value)}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || readOnly) return;
          const to: Record<string, (() => number) | undefined> = {
            ArrowUp: () => snap(current() + step),
            ArrowDown: () => snap(current() - step),
            PageUp: () => snap(current() + largeStep),
            PageDown: () => snap(current() - largeStep),
            Home: min === undefined ? undefined : () => min,
            End: max === undefined ? undefined : () => max,
            Enter: text === null ? undefined : current,
          };
          const next = to[event.key];
          if (!next) return;
          // Enter commits what was typed and still submits the form.
          if (event.key !== "Enter") event.preventDefault();
          set(next());
        }}
        onBlur={(event) => {
          if (text !== null) set(current());
          onBlur?.(event);
        }}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1 tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed raymond:mx-0.5 raymond:my-0.75 raymond:px-0.5 raymond:py-0 raymond:focus-visible:focus-ring raymond:focus-visible:[--focus-offset:0px] raymond:disabled:text-(--3d-shadow)"
        {...props}
      />
      <div
        data-slot="number-input-steps"
        className="flex flex-col border-input border-l touch:flex-row-reverse raymond:my-0.5 raymond:mr-0.5 raymond:border-0"
      >
        {stepButton(1)}
        {stepButton(-1)}
      </div>
    </div>
  );
}

export { NumberInput };
