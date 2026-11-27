import type * as React from "react";

/**
 * Whether a click on a link is the app's to take over: a plain left click, on a link that opens
 * in place, that nothing before has handled. A link that navigates in JS calls this first and
 * leaves every other click to the browser, so a modified click (a new tab, a new window, a
 * download) and a middle or right click open the link where the reader asked.
 */
export function isPlainClick(event: React.MouseEvent<Element>): boolean {
  return !event.defaultPrevented && isPlainPress(event);
}

/**
 * `isPlainClick` without its refusal of a click already handled: what opens a closed group or
 * branch when the reader clicks its place. By then a link that opens in place, or a router's
 * link, has called `preventDefault` itself, and the reader still went to the place.
 */
export function isPlainPress(event: React.MouseEvent<Element>): boolean {
  if (isModifiedClick(event)) return false;
  const target = event.currentTarget.getAttribute("target");
  return target === null || target === "" || target === "_self";
}

/**
 * Whether the reader asked the browser for something of its own with a click on a link: a new
 * tab, a new window, a download. That is a click with another button than the left, or with a
 * modifier held, whatever the link's `target`. A menu or a list of places leaves such a click
 * to the browser and stays open for the next one; it closes on any other, the reader having
 * picked the place.
 */
export function isModifiedClick(event: React.MouseEvent<Element>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
