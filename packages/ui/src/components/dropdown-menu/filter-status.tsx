import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * How long the typing rests before what it left is spoken: longer than the
 * gap between two keys, so a burst of letters is read out once, for the
 * last, rather than queueing a stale count per letter.
 */
export const FILTER_STATUS_MS = 500;

export const resultCount = (count: number) =>
  count === 1 ? "1 result" : `${count} results`;

/**
 * What typing in a filter box left, spoken to a screen reader once the
 * typing rests: how many rows, or with none the empty state's own words.
 * It says nothing until the box is typed in, so opening a menu reads only
 * the box. Rows that arrive late, from a filter that lags the query, are
 * waited for in the same way.
 *
 * Two regions take turns: a region given the words it already holds has not
 * changed, and a screen reader would stay silent after a letter that leaves
 * the count as it was.
 */
export function FilterStatus({
  edits,
  count,
  empty,
  countLabel,
}: {
  /** Changes the user made in the box since it opened; none means silence. */
  edits: number;
  count: number;
  /** The empty state as drawn; its text is spoken when no rows are left. */
  empty: RefObject<HTMLElement | null>;
  countLabel: (count: number) => string;
}) {
  const [said, setSaid] = useState({ text: "", turn: 0 });
  const label = useRef(countLabel);
  label.current = countLabel;
  useEffect(() => {
    if (edits === 0) {
      setSaid((now) => (now.text === "" ? now : { text: "", turn: 0 }));
      return;
    }
    const timer = setTimeout(() => {
      const text =
        count === 0
          ? (empty.current?.textContent?.trim() ?? "")
          : label.current(count);
      setSaid((now) => ({ text, turn: 1 - now.turn }));
    }, FILTER_STATUS_MS);
    return () => clearTimeout(timer);
  }, [edits, count, empty]);
  return (
    <>
      <span role="status" className="sr-only">
        {said.turn === 0 ? said.text : ""}
      </span>
      <span role="status" className="sr-only">
        {said.turn === 1 ? said.text : ""}
      </span>
    </>
  );
}
