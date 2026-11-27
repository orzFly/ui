import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { POINTER_FINE } from "../../hooks/use-media-query.ts";

/** The search row both filter surfaces draw: FilterMenu's and a filtering submenu's. */
export function FilterBox({
  expanded,
  ...props
}: ComponentProps<"input"> & { expanded: boolean }) {
  return (
    // Under raymond a text box: a sunken well in the window colour, inset
    // from the menu's frame, with no rule under it.
    <div className="flex items-center gap-2 border-b px-2.5 raymond:m-1 raymond:gap-1 raymond:border-b-0 raymond:bg-(--window) raymond:px-1 raymond:shadow-sunken">
      <SearchIcon
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-control-lg min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-ui touch:h-field-touch touch:text-base"
        {...props}
      />
    </div>
  );
}

/**
 * A `[data-pointer]` ancestor first, as `touch:` reads it, so a preview that
 * forces touch sizing opens the menu as a phone does; then the primary pointer.
 */
export function finePointer(el: Element | null): boolean {
  const forced = el?.closest("[data-pointer]")?.getAttribute("data-pointer");
  if (forced === "coarse" || forced === "fine") return forced === "fine";
  return typeof matchMedia !== "function" || matchMedia(POINTER_FINE).matches;
}

/** An Enter or Escape that belongs to the IME: `isComposing`, or Safari's keyCode 229. */
export const isComposing = (event: globalThis.KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;
