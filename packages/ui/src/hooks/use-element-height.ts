import { useEffect, useRef, useState } from "react";

/**
 * The live height of one element, for anything that has to sit directly
 * beneath it — a header that gains a second row on narrow screens has a
 * height no CSS offset can name. `fallback` stands in until the first
 * measurement, and for good when `target` finds nothing.
 *
 * `target` is asked once, after mount (`() => ref.current`, or a
 * `querySelector`), so it may be a fresh closure every render.
 */
export function useElementHeight(
  target: () => Element | null,
  fallback: number,
): number {
  const [height, setHeight] = useState(fallback);
  const find = useRef(target);
  find.current = target;

  useEffect(() => {
    const element = find.current();
    if (element === null) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return height;
}
