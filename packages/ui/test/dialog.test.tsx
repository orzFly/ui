import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Window } from "happy-dom";
import { type ComponentProps, type ReactElement, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../src/components/confirm-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
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
import { Sheet, SheetContent, SheetTitle } from "../src/components/sheet.tsx";

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

/** A row that opens an overlay through `open` alone, with no Trigger. */
function OpenedByState({ as }: { as: "dialog" | "sheet" }) {
  const [open, setOpen] = useState(false);
  const Root = as === "dialog" ? Dialog : Sheet;
  const Content = as === "dialog" ? DialogContent : SheetContent;
  const Title = as === "dialog" ? DialogTitle : SheetTitle;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        notes.txt
      </button>
      <Root open={open} onOpenChange={setOpen}>
        <Content aria-describedby={undefined}>
          <Title>notes.txt</Title>
        </Content>
      </Root>
    </>
  );
}

describe.each(["dialog", "sheet"] as const)(
  "%s opened without a trigger",
  (as) => {
    it("hands focus back to what opened it on close (UI-183)", async () => {
      render(<OpenedByState as={as} />);
      const row = screen.getByRole("button", { name: "notes.txt" });
      row.focus();
      fireEvent.click(row);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      const calls = watchFocus(row);

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => expect(document.activeElement).toBe(row));
      expect(calls.every((options) => options?.preventScroll === true)).toBe(
        true,
      );
    });
  },
);

it("still hands a dialog's focus to its trigger", async () => {
  render(
    <Dialog>
      <DialogTrigger>Rename</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Rename</DialogTitle>
      </DialogContent>
    </Dialog>,
  );
  const trigger = screen.getByRole("button", { name: "Rename" });
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

  fireEvent.keyDown(document, { key: "Escape" });

  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

/** A part of the page rendered into another document, asking from there. */
function AskedElsewhere({ body }: { body: HTMLElement }) {
  const [open, setOpen] = useState(false);
  return createPortal(
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Submit
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Submit with 2 unanswered?"
        onConfirm={() => setOpen(false)}
        container={body}
      />
    </>,
    body,
  );
}

/**
 * The other window's document. happy-dom loads no frame, so it is a bare
 * document: it keeps its own focus apart from this one's, which is what the
 * restore has to tell apart, but shares this realm, so the `instanceof`
 * across realms that a real Picture-in-Picture window brings needs a browser.
 */
describe("a confirm portalled into another window (UI-231)", () => {
  const left = document.createElement("button");
  afterEach(() => left.remove());

  it("opens in the container, not in this document", async () => {
    const other = document.implementation.createHTMLDocument("");
    render(<AskedElsewhere body={other.body} />);
    act(() => (other.querySelector("button") as HTMLElement).click());

    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).not.toBeNull(),
    );
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("hands the focus back to its opener there, not to this window's", async () => {
    const other = document.implementation.createHTMLDocument("");
    // What last had the focus in the page the other window was opened from.
    document.body.append(left);
    left.focus();
    render(<AskedElsewhere body={other.body} />);
    const submit = other.querySelector("button") as HTMLElement;
    submit.focus();
    act(() => submit.click());
    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).not.toBeNull(),
    );
    const cancel = [...other.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancel",
    ) as HTMLElement;

    act(() => cancel.click());

    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).toBeNull(),
    );
    await waitFor(() => expect(other.activeElement).toBe(submit));
    expect(document.activeElement).toBe(left);
  });
});

/** A rename dialog in another window, opened from a trigger there. */
function RenameElsewhere({
  body,
  ...props
}: { body: HTMLElement } & Pick<
  ComponentProps<typeof DialogContent>,
  "onPointerDownOutside" | "onInteractOutside"
> &
  Pick<ComponentProps<typeof Dialog>, "onOpenChange">) {
  const [line, setLine] = useState(true);
  return createPortal(
    <Dialog onOpenChange={props.onOpenChange}>
      <DialogTrigger>Rename</DialogTrigger>
      <DialogContent
        container={body}
        onPointerDownOutside={props.onPointerDownOutside}
        onInteractOutside={props.onInteractOutside}
      >
        <DialogTitle>Rename project</DialogTitle>
        <input aria-label="Name" defaultValue="orzui" />
        {line && <p>Taken by another project</p>}
        <button type="button" onClick={() => setLine(false)}>
          Clear
        </button>
      </DialogContent>
    </Dialog>,
    body,
  );
}

/**
 * Another happy-dom window, for what Radix does with this window's document
 * while its dialog is in that one's. It shares this realm, so its press on
 * the scrim is one Radix would handle too; that it is handled once is what
 * keeps a Radix that judges it across realms from closing the dialog twice.
 */
describe("a dialog portalled into another window (UI-232)", () => {
  const windows: Window[] = [];
  afterEach(async () => {
    // Unmounted first: a closed window's document no longer gives the
    // portal back.
    cleanup();
    for (const other of windows.splice(0)) await other.happyDOM.close();
  });

  async function open(
    props: Omit<Parameters<typeof RenameElsewhere>[0], "body"> = {},
  ) {
    const view = new Window();
    windows.push(view);
    const other = view.document as unknown as Document;
    render(<RenameElsewhere body={other.body} {...props} />);
    const trigger = other.querySelector("button") as HTMLElement;
    trigger.focus();
    act(() => trigger.click());
    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).not.toBeNull(),
    );
    const field = other.querySelector("input") as HTMLInputElement;
    const scrim = other.querySelector(
      "[data-slot=dialog-overlay]",
    ) as HTMLElement;
    // Radix listens for a press outside from the next task on.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    return { other, trigger, field, scrim };
  }

  it("opens with the focus on its first field there", async () => {
    const { other, field } = await open();
    await waitFor(() => expect(other.activeElement).toBe(field));
  });

  it("brings Tab round from its last control to its first, and back", async () => {
    const { other, field } = await open();
    const close = other.querySelector(
      "[data-slot=dialog-content] > [data-slot=dialog-close]",
    ) as HTMLElement;
    close.focus();

    fireEvent.keyDown(close, { key: "Tab" });
    expect(other.activeElement).toBe(field);

    fireEvent.keyDown(field, { key: "Tab", shiftKey: true });
    expect(other.activeElement).toBe(close);
  });

  it("sends the focus back when it lands behind the dialog", async () => {
    const { other, trigger, field } = await open();
    await waitFor(() => expect(other.activeElement).toBe(field));

    act(() => trigger.focus());

    expect(other.activeElement).toBe(field);
  });

  it("keeps the focus on its field when a line inside is removed", async () => {
    const { other, field } = await open();
    // Nothing holds the focus in this window, as when the button that
    // opened the other one has gone: Radix takes that for the focused node
    // having been removed.
    expect(document.activeElement).toBe(document.body);
    const clear = [...other.querySelectorAll("button")].find(
      (button) => button.textContent === "Clear",
    ) as HTMLElement;
    act(() => field.focus());
    act(() => clear.click());
    await waitFor(() => expect(other.querySelector("p")).toBeNull());
    await act(() => Promise.resolve());

    expect(other.activeElement).toBe(field);
  });

  it("closes on a press of its scrim, once", async () => {
    const onOpenChange = vi.fn();
    const onPointerDownOutside = vi.fn();
    const { other, scrim } = await open({ onOpenChange, onPointerDownOutside });

    fireEvent.pointerDown(scrim, { button: 0 });
    fireEvent.click(scrim);

    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).toBeNull(),
    );
    expect(onPointerDownOutside).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("stays open when the press is prevented", async () => {
    const { other, scrim } = await open({
      onInteractOutside: (event) => event.preventDefault(),
    });

    fireEvent.pointerDown(scrim, { button: 0 });
    fireEvent.click(scrim);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(other.querySelector("[role=dialog]")).not.toBeNull();
  });

  it("locks scrolling in its own window, not in this one", async () => {
    const { other, scrim } = await open();
    expect(other.documentElement.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);

    fireEvent.pointerDown(scrim, { button: 0 });
    fireEvent.click(scrim);

    await waitFor(() =>
      expect(other.querySelector("[role=dialog]")).toBeNull(),
    );
    expect(other.documentElement.style.overflow).toBe("");
  });
});

// An overlay's duration is meant for its open/close keyframes; with the
// initial `transition-property: all` it would also ease every size change
// made while the overlay is open.
describe("overlay contents ease nothing while open", () => {
  const overlays: [string, ReactElement][] = [
    [
      "dialog-content",
      <Dialog key="dialog" defaultOpen>
        <DialogContent>
          <DialogTitle>Viewer</DialogTitle>
        </DialogContent>
      </Dialog>,
    ],
    [
      "popover-content",
      <Popover key="popover" defaultOpen>
        <PopoverTrigger>Files</PopoverTrigger>
        <PopoverContent>list</PopoverContent>
      </Popover>,
    ],
    [
      "dropdown-menu-content",
      <DropdownMenu key="menu" defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    ],
  ];
  for (const [slot, element] of overlays) {
    it(`${slot} sets transition-none beside the keyframe duration`, async () => {
      render(element);
      await waitFor(() =>
        expect(
          document.querySelector(`[data-slot="${slot}"]`)?.className,
        ).toContain("transition-none"),
      );
    });
  }
});
