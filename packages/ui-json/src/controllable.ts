import { useCallback, useRef, useState } from "react";

/** Controlled when `value` is not `undefined`, like a radix primitive. */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((value: T) => void) | undefined,
  same: (a: T, b: T) => boolean,
) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const currentRef = useRef(current);
  currentRef.current = current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const set = useCallback(
    (next: T) => {
      if (same(currentRef.current, next)) return;
      // Later calls in the same event see this one before the re-render.
      currentRef.current = next;
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled, same],
  );
  return [current, set, currentRef] as const;
}
