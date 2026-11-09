import type * as React from "react";

/**
 * Whether a click on a link is the app's to take over: a plain left click, on a link that opens
 * in place, that nothing before has handled. A link that navigates in JS calls this first and
 * leaves every other click to the browser, so a modified click (a new tab, a new window, a
 * download) and a middle or right click open the link where the reader asked.
 */
export function isPlainClick(event: React.MouseEvent<Element>): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = event.currentTarget.getAttribute("target");
  return target === null || target === "" || target === "_self";
}
