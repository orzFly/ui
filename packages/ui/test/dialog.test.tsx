import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../src/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../src/components/popover.tsx";

/**
 * The release `dialog.tsx` performs for a finger (T-450, T-471) needs two
 * things happy-dom cannot produce: a shadow root that retargets `event.target`
 * to its host, and a box with room to scroll. Both are staged here, because
 * what this file grades is the origin bookkeeping between one touchstart and
 * the next, not the geometry — the real gesture over a real shadow root needs
 * a browser.
 *
 * happy-dom does not retarget at all: its `event.target` stays the node the
 * event was dispatched on, while `composedPath()` reads an internal field, so
 * an own `target` property shadows the one without disturbing the other — the
 * same pair of answers a real open shadow root gives.
 */
const HOST = "shadow-host";
const SCROLLER = "shadow-scroller";

function stageScroller(): { host: HTMLElement; scroller: HTMLElement } {
  const host = document.querySelector<HTMLElement>(`[data-testid="${HOST}"]`);
  const scroller = document.querySelector<HTMLElement>(
    `[data-testid="${SCROLLER}"]`,
  );
  if (host === null || scroller === null)
    throw new Error("dialog never opened");
  for (const [property, value] of [
    ["scrollWidth", 500],
    ["clientWidth", 100],
    ["scrollLeft", 0],
  ] as const) {
    Object.defineProperty(scroller, property, {
      value,
      configurable: true,
      writable: true,
    });
  }
  return { host, scroller };
}

function touch(x: number, y: number, identifier: number, target: EventTarget) {
  return new Touch({ identifier, target, clientX: x, clientY: y });
}

/**
 * One touch event, dispatched on the scroller but claiming the host as its
 * target, which is what the lock and the release both read.
 */
function sendTouch(
  type: "touchstart" | "touchmove" | "touchend",
  points: Touch[],
  { host, scroller }: { host: HTMLElement; scroller: HTMLElement },
) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: points,
    targetTouches: points,
    changedTouches: points,
  });
  Object.defineProperty(event, "target", { value: host, configurable: true });
  fireEvent(scroller, event);
}

function openDialog() {
  return render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Revision</DialogTitle>
        <div data-testid={HOST}>
          <div data-testid={SCROLLER} style={{ overflowX: "scroll" }}>
            a very long line
          </div>
        </div>
      </DialogContent>
    </Dialog>,
  );
}

/** Touchmoves the release let through to the document — the lock's reach. */
function countArrivals(): { count: () => number; stop: () => void } {
  let arrived = 0;
  const listener = () => {
    arrived += 1;
  };
  window.addEventListener("touchmove", listener);
  return {
    count: () => arrived,
    stop: () => window.removeEventListener("touchmove", listener),
  };
}

describe("a sideways drag inside a dialog's shadow scroller", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("stays released after a second finger joins and leaves (T-490)", () => {
    const view = openDialog();
    cleanups.push(() => view.unmount());
    const nodes = stageScroller();
    const window_ = countArrivals();
    cleanups.push(window_.stop);

    const first = (x: number) => touch(x, 100, 1, nodes.host);
    sendTouch("touchstart", [first(300)], nodes);
    sendTouch("touchmove", [first(280)], nodes);
    expect(window_.count()).toBe(0);

    // The interlude: a second finger lands and lifts again, with the first
    // never leaving the glass.
    sendTouch(
      "touchstart",
      [first(280), touch(120, 300, 2, nodes.host)],
      nodes,
    );
    sendTouch("touchend", [first(280)], nodes);

    sendTouch("touchmove", [first(240)], nodes);
    expect(window_.count()).toBe(0);
  });

  it("still stands down while two fingers are on the glass", () => {
    const view = openDialog();
    cleanups.push(() => view.unmount());
    const nodes = stageScroller();
    const window_ = countArrivals();
    cleanups.push(window_.stop);

    const first = (x: number) => touch(x, 100, 1, nodes.host);
    sendTouch("touchstart", [first(300)], nodes);
    sendTouch(
      "touchstart",
      [first(300), touch(120, 300, 2, nodes.host)],
      nodes,
    );
    sendTouch("touchmove", [first(260), touch(140, 300, 2, nodes.host)], nodes);

    // The lock answers a pinch before it asks about scrollers, so this one has
    // to reach it rather than be handed past it.
    expect(window_.count()).toBe(1);
  });
});

async function openMenu() {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Status</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Backlog</DropdownMenuItem>
        <DropdownMenuItem>In Progress</DropdownMenuItem>
        <DropdownMenuItem>Shipped</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  const trigger = screen.getByRole("button", { name: "Status" });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
  return trigger;
}

async function openPopover() {
  render(
    <Popover>
      <PopoverTrigger>Edit labels</PopoverTrigger>
      <PopoverContent>
        <button type="button">bug</button>
      </PopoverContent>
    </Popover>,
  );
  const trigger = screen.getByRole("button", { name: "Edit labels" });
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  return trigger;
}

/** Record every focus() the restore makes, arguments included. */
function watchFocus(element: HTMLElement) {
  const calls: (FocusOptions | undefined)[] = [];
  const original = element.focus.bind(element);
  element.focus = (options?: FocusOptions) => {
    calls.push(options);
    original(options);
  };
  return calls;
}

describe.each([
  ["dropdown menu", openMenu],
  ["popover", openPopover],
])("%s focus restore", (_name, open) => {
  it("hands focus back to the trigger on close", async () => {
    const trigger = await open();

    fireEvent.keyDown(document, { key: "Escape" });

    // Compare the element itself: `document.activeElement?.something` passes
    // vacuously while focus is nowhere, which is the failure being guarded —
    // taking the restore over from Radix is what could drop it on the floor.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("restores without letting the browser scroll the trigger into view", async () => {
    const trigger = await open();
    const calls = watchFocus(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    // happy-dom has no layout, so the scroll itself is unobservable here and
    // only the argument that suppresses it can be asserted. Radix's own
    // restore passes none, which is what sends the page travelling; the
    // viewport-level version of this needs a browser.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((options) => options?.preventScroll === true)).toBe(
      true,
    );
  });
});

describe("overlay focus restore stands aside for an outside interaction", () => {
  it("leaves focus in the field a click outside the popover moved it to", async () => {
    render(
      <>
        <Popover>
          <PopoverTrigger>Edit labels</PopoverTrigger>
          <PopoverContent>
            <button type="button">bug</button>
          </PopoverContent>
        </Popover>
        <textarea aria-label="Write a comment" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit labels" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

    // A popover is non-modal: the click reaches the textarea and focuses it
    // before the dismissal is even decided. Pulling focus back to the trigger
    // from here is what takes a phone's keyboard down under the user.
    const field = screen.getByLabelText("Write a comment");
    field.focus();
    fireEvent.pointerDown(field, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(field, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(document.activeElement).toBe(field);
  });

  // The popover's rule deliberately does not transfer to the menu. A menu is
  // modal, so its layer puts `pointer-events: none` on the body and the
  // element under an outside right click never receives it — the pointerdown
  // lands on `html`, focus never leaves the menu, and there is nothing the
  // user placed to preserve. Standing aside for Radix here buys
  // `document.body` instead, measured in Chromium both ways on T-388. The
  // restore stays, and this pins that it does.
  it("still restores the trigger after a right click outside the menu", async () => {
    render(
      <>
        <DropdownMenu>
          <DropdownMenuTrigger>Status</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Backlog</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <textarea aria-label="Write a comment" />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Status" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());

    const field = screen.getByLabelText("Write a comment");
    field.focus();
    fireEvent.pointerDown(field, { button: 2, pointerType: "mouse" });
    fireEvent.pointerUp(field, { button: 2, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    expect(document.activeElement).toBe(trigger);
  });
});
