import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  moveInGroups,
  moveItem,
  Reorder,
  ReorderButtons,
  ReorderGroup,
  ReorderHandle,
  ReorderItem,
  type ReorderMove,
  type ReorderProps,
} from "../src/components/reorder.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../src/components/table.tsx";
import {
  H,
  HEAD,
  type ReorderLayout,
  stubReorderLayout,
} from "./stub-reorder-layout.ts";

const NAMES: Record<string, string> = {
  push: "Push",
  email: "Email",
  chat: "Chat",
  sms: "SMS",
  desk: "Desktop",
};

type Rules = Partial<
  Omit<ReorderProps, "items" | "groups" | "onMove" | "children">
>;
type Adopt = "now" | "never" | "later";

/**
 * Holds the last move a `later` list was handed, to take it when the test
 * says, and the list's setter, to change its order from outside.
 */
const later: { take?: () => void; set?: (items: string[]) => void } = {};

const nameOf = (id: string) => NAMES[id] ?? id;

function List({
  initial = ["push", "email", "chat"],
  adopt = "now",
  onMove,
  rules,
  extra,
  heights,
  onRowClick,
}: {
  initial?: string[];
  adopt?: Adopt;
  onMove?: (move: ReorderMove) => void;
  rules?: Rules;
  extra?: (id: string) => ReactNode;
  heights?: Record<string, number>;
  onRowClick?: (id: string) => void;
}) {
  const [items, setItems] = useState(initial);
  later.set = setItems;
  return (
    <div data-testid="host">
      <Reorder
        items={items}
        onMove={(move) => {
          onMove?.(move);
          const take = () => setItems((xs) => moveItem(xs, move));
          if (adopt === "now") take();
          if (adopt === "later") later.take = take;
        }}
        asChild
        {...rules}
      >
        <ul>
          {items.map((id) => (
            <ReorderItem key={id} id={id} name={nameOf(id)} asChild>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: a test row */}
              <li
                data-testid={id}
                data-test-height={heights?.[id]}
                onClick={() => onRowClick?.(id)}
              >
                <ReorderHandle />
                <span>{nameOf(id)}</span>
                {extra?.(id)}
                <ReorderButtons />
              </li>
            </ReorderItem>
          ))}
        </ul>
      </Reorder>
    </div>
  );
}

type Group = { id: string; name: string; items: readonly string[] };
const TIERS: Group[] = [
  { id: "first", name: "Notify first", items: ["push", "email"] },
  { id: "fallback", name: "If nobody answers", items: ["chat", "sms"] },
  { id: "paused", name: "Paused", items: [] },
];

function Groups({
  initial = TIERS,
  adopt = "now",
  onMove,
  rules,
  heights,
}: {
  initial?: Group[];
  adopt?: Adopt;
  onMove?: (move: ReorderMove) => void;
  rules?: Rules | ((groups: Group[]) => Rules);
  heights?: Record<string, number>;
}) {
  const [groups, setGroups] = useState(initial);
  return (
    <div data-testid="host">
      <Reorder
        groups={groups}
        onMove={(move) => {
          onMove?.(move);
          const take = () => setGroups((gs) => moveInGroups(gs, move));
          if (adopt === "now") take();
          if (adopt === "later") later.take = take;
        }}
        {...(typeof rules === "function" ? rules(groups) : rules)}
      >
        {groups.map((group) => (
          <ReorderGroup key={group.id} id={group.id} name={group.name}>
            <h3>{group.name}</h3>
            <ul>
              {group.items.map((id) => (
                <ReorderItem key={id} id={id} name={NAMES[id]} asChild>
                  <li data-testid={id} data-test-height={heights?.[id]}>
                    <ReorderHandle />
                    <span>{NAMES[id]}</span>
                    <ReorderButtons />
                  </li>
                </ReorderItem>
              ))}
            </ul>
          </ReorderGroup>
        ))}
      </Reorder>
    </div>
  );
}

const button = (name: string) => screen.getByRole("button", { name });
const order = () =>
  [...document.querySelectorAll('[data-slot="reorder-item"]')].map((el) =>
    el.getAttribute("data-testid"),
  );
const groupOrder = () =>
  [...document.querySelectorAll('[data-slot="reorder-group"]')].map((g) =>
    [...g.querySelectorAll('[data-slot="reorder-item"]')].map((el) =>
      el.getAttribute("data-testid"),
    ),
  );
const status = () => document.querySelector('[role="status"]');
const frame = () => act(() => vi.advanceTimersByTime(20));

let layout: ReorderLayout;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  layout = stubReorderLayout();
  later.take = undefined;
});

afterEach(() => {
  layout.restore();
  vi.useRealTimers();
});

describe("Reorder parts", () => {
  it("marks each part with its slot, on the caller's elements with asChild", () => {
    render(<Groups />);
    const root = document.querySelector('[data-slot="reorder"]');
    expect(root?.tagName).toBe("DIV");
    expect(
      document.querySelectorAll('[data-slot="reorder-group"]'),
    ).toHaveLength(3);
    expect(screen.getByTestId("push").getAttribute("data-slot")).toBe(
      "reorder-item",
    );
    expect(screen.getByTestId("push").tagName).toBe("LI");
    expect(
      screen.getByTestId("push").querySelector('[data-slot="reorder-handle"]'),
    ).not.toBeNull();
    expect(
      screen.getByTestId("push").querySelector('[data-slot="reorder-buttons"]'),
    ).not.toBeNull();
  });

  it("lands on a table's body and rows", () => {
    render(
      <Table>
        <Reorder items={["a", "b"]} onMove={() => {}} asChild>
          <TableBody>
            {["a", "b"].map((id) => (
              <ReorderItem key={id} id={id} name={id} asChild>
                <TableRow>
                  <TableCell>
                    <ReorderHandle />
                  </TableCell>
                  <TableCell>{id}</TableCell>
                  <TableCell>
                    <ReorderButtons />
                  </TableCell>
                </TableRow>
              </ReorderItem>
            ))}
          </TableBody>
        </Reorder>
      </Table>,
    );
    const body = document.querySelector('[data-slot="reorder"]');
    expect(body?.tagName).toBe("TBODY");
    expect(body?.getAttribute("data-slot")).toBe("reorder");
    const rows = document.querySelectorAll('[data-slot="reorder-item"]');
    expect([...rows].map((r) => r.tagName)).toEqual(["TR", "TR"]);
  });

  it("throws for a part outside its parent", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ReorderItem id="a" name="A" />)).toThrow(/Reorder/);
    expect(() => render(<ReorderGroup id="g" name="G" />)).toThrow(/Reorder/);
    expect(() =>
      render(
        <Reorder items={["a"]} onMove={() => {}}>
          <ReorderHandle />
        </Reorder>,
      ),
    ).toThrow(/ReorderItem/);
    expect(() =>
      render(
        <Reorder items={["a"]} onMove={() => {}}>
          <ReorderButtons />
        </Reorder>,
      ),
    ).toThrow(/ReorderItem/);
  });

  it("hides the handle from screen readers and keeps it out of the Tab order", () => {
    render(<List />);
    const handle = screen
      .getByTestId("push")
      .querySelector('[data-slot="reorder-handle"]') as HTMLElement;
    expect(handle.getAttribute("aria-hidden")).toBe("true");
    expect(handle.hasAttribute("tabindex")).toBe(false);
  });

  it("names a row that is in no list, and disables its controls", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Reorder items={["a", "b"]} onMove={() => {}}>
        <ReorderItem id="z" name="Zed">
          <ReorderHandle />
          <ReorderButtons />
        </ReorderItem>
      </Reorder>,
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"z"'));
    expect(button("Move Zed up")).toHaveProperty("disabled", true);
    expect(button("Move Zed down")).toHaveProperty("disabled", true);
    expect(
      document
        .querySelector('[data-slot="reorder-handle"]')
        ?.hasAttribute("data-disabled"),
    ).toBe(true);
  });

  it("names an id held twice, and a group not in groups", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Reorder items={["a", "a"]} onMove={() => {}}>
        <ReorderItem id="a" name="A" />
      </Reorder>,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("more than once"),
    );
    error.mockClear();
    render(
      <Reorder groups={[{ id: "g", items: [] }]} onMove={() => {}}>
        <ReorderGroup id="h" name="H" />
      </Reorder>,
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"h"'));
  });
});

describe("Reorder buttons", () => {
  it("names each button for its row, with the key that presses it", () => {
    render(<List />);
    const up = button("Move Email up");
    expect(up.getAttribute("aria-keyshortcuts")).toBe("Alt+ArrowUp");
    expect(button("Move Email down").getAttribute("aria-keyshortcuts")).toBe(
      "Alt+ArrowDown",
    );
  });

  it("disables the button pointing past either end", () => {
    render(<List />);
    expect(button("Move Push up")).toHaveProperty("disabled", true);
    expect(button("Move Push down")).toHaveProperty("disabled", false);
    expect(button("Move Chat down")).toHaveProperty("disabled", true);
  });

  it("disables every control while the list is disabled", () => {
    render(<List rules={{ disabled: true }} />);
    for (const b of screen.getAllByRole("button"))
      expect(b).toHaveProperty("disabled", true);
    for (const h of document.querySelectorAll('[data-slot="reorder-handle"]'))
      expect(h.hasAttribute("data-disabled")).toBe(true);
  });

  it("disables a row canMove holds still", () => {
    render(<List rules={{ canMove: (id) => id !== "email" }} />);
    expect(button("Move Email up")).toHaveProperty("disabled", true);
    expect(button("Move Email down")).toHaveProperty("disabled", true);
    expect(button("Move Push down")).toHaveProperty("disabled", false);
    const handle = (id: string) =>
      screen.getByTestId(id).querySelector('[data-slot="reorder-handle"]');
    expect(handle("email")?.hasAttribute("data-disabled")).toBe(true);
    expect(handle("push")?.hasAttribute("data-disabled")).toBe(false);
  });

  it("moves to the next place canDrop accepts, across groups", () => {
    const onMove = vi.fn();
    // The first group takes at most two rows.
    const rules = (groups: Group[]): Rules => ({
      canDrop: (id, to) =>
        to.group !== "first" ||
        groups[0].items.filter((i) => i !== id).length < 2,
    });
    render(<Groups onMove={onMove} rules={rules} />);
    expect(button("Move Chat up")).toHaveProperty("disabled", true);
    fireEvent.click(button("Move Email down"));
    expect(onMove).toHaveBeenLastCalledWith({
      id: "email",
      from: { group: "first", index: 1 },
      to: { group: "fallback", index: 0 },
    });
    expect(groupOrder()).toEqual([["push"], ["email", "chat", "sms"], []]);
    // With room in the first group, Chat's ↑ goes up into it.
    expect(button("Move Chat up")).toHaveProperty("disabled", false);
    fireEvent.click(button("Move SMS down"));
    expect(onMove).toHaveBeenLastCalledWith({
      id: "sms",
      from: { group: "fallback", index: 2 },
      to: { group: "paused", index: 0 },
    });
  });

  it("asks canMoveUp and canMoveDown rather than walking canDrop", () => {
    const canDrop = vi.fn(() => true);
    render(
      <List
        rules={{
          canDrop,
          canMoveUp: (id) => id === "chat",
          canMoveDown: () => false,
        }}
      />,
    );
    expect(canDrop).not.toHaveBeenCalled();
    expect(button("Move Email up")).toHaveProperty("disabled", true);
    expect(button("Move Chat up")).toHaveProperty("disabled", false);
    expect(button("Move Push down")).toHaveProperty("disabled", true);
  });

  it("does nothing, and warns, when canMoveUp promises a place canDrop refuses", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onMove = vi.fn();
    render(
      <List
        onMove={onMove}
        rules={{ canDrop: () => false, canMoveUp: () => true }}
      />,
    );
    fireEvent.click(button("Move Chat up"));
    expect(onMove).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(order()).toEqual(["push", "email", "chat"]);
  });

  it("hands onMove one move: in a list, within a group, across groups", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    fireEvent.click(button("Move Push down"));
    expect(onMove).toHaveBeenLastCalledWith({
      id: "push",
      from: { index: 0 },
      to: { index: 1 },
    });
    expect(order()).toEqual(["email", "push", "chat"]);
  });

  it("hands onMove a move within a group and one across", () => {
    const onMove = vi.fn();
    render(<Groups onMove={onMove} />);
    fireEvent.click(button("Move SMS up"));
    expect(onMove).toHaveBeenLastCalledWith({
      id: "sms",
      from: { group: "fallback", index: 1 },
      to: { group: "fallback", index: 0 },
    });
    fireEvent.click(button("Move SMS up"));
    expect(onMove).toHaveBeenLastCalledWith({
      id: "sms",
      from: { group: "fallback", index: 0 },
      to: { group: "first", index: 2 },
    });
    expect(groupOrder()).toEqual([["push", "email", "sms"], ["chat"], []]);
  });
});

describe("Reorder focus", () => {
  it("keeps the focus on the pressed button as its row moves", () => {
    render(<List />);
    const down = button("Move Push down");
    act(() => down.focus());
    fireEvent.click(down);
    expect(order()).toEqual(["email", "push", "chat"]);
    expect(document.activeElement).toBe(button("Move Push down"));
  });

  it("passes the focus to the row's other button at an end", () => {
    render(<List />);
    const down = button("Move Email down");
    act(() => down.focus());
    fireEvent.click(down);
    expect(order()).toEqual(["push", "chat", "email"]);
    expect(button("Move Email down")).toHaveProperty("disabled", true);
    expect(document.activeElement).toBe(button("Move Email up"));
  });

  it("leaves the focus and the order alone when the app keeps its order", () => {
    render(<List adopt="never" />);
    const down = button("Move Push down");
    act(() => down.focus());
    fireEvent.click(down);
    frame();
    expect(order()).toEqual(["push", "email", "chat"]);
    expect(document.activeElement).toBe(down);
  });
});

describe("Reorder keyboard", () => {
  const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
    fireEvent.keyDown(el, { key: k, altKey: true, ...init });

  it("moves the row on Alt+↑ and Alt+↓ from a button in it", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const up = button("Move Email up");
    act(() => up.focus());
    key(up, "ArrowUp");
    expect(order()).toEqual(["email", "push", "chat"]);
    key(button("Move Email up"), "ArrowDown");
    expect(order()).toEqual(["push", "email", "chat"]);
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("leaves Alt+arrows to a text field in the row", () => {
    const onMove = vi.fn();
    render(
      <List
        onMove={onMove}
        extra={(id) => <input aria-label={`Note for ${id}`} />}
      />,
    );
    key(screen.getByLabelText("Note for email"), "ArrowUp");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("takes no Alt+arrow with Ctrl, ⌘ or Shift", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const up = button("Move Email up");
    key(up, "ArrowUp", { ctrlKey: true });
    key(up, "ArrowUp", { metaKey: true });
    key(up, "ArrowUp", { shiftKey: true });
    key(up, "ArrowUp", { altKey: false });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does nothing where the button that way is disabled", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    key(button("Move Push up"), "ArrowUp");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves only the nearest row when one list sits in another's row", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Reorder items={["a", "b"]} onMove={outer}>
        <ReorderItem id="a" name="A">
          <ReorderButtons />
        </ReorderItem>
        <ReorderItem id="b" name="B">
          <Reorder items={["x", "y"]} onMove={inner}>
            <ReorderItem id="x" name="X">
              <ReorderButtons />
            </ReorderItem>
            <ReorderItem id="y" name="Y">
              <ReorderButtons />
            </ReorderItem>
          </Reorder>
        </ReorderItem>
      </Reorder>,
    );
    key(button("Move Y up"), "ArrowUp");
    expect(inner).toHaveBeenCalledWith({
      id: "y",
      from: { index: 1 },
      to: { index: 0 },
    });
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("Reorder announcements", () => {
  it("puts its live region beside the root, outside a list", () => {
    render(<List />);
    expect(status()?.parentElement).toBe(screen.getByTestId("host"));
    expect(status()?.getAttribute("aria-live")).toBe("polite");
  });

  it("puts it outside the table when the root is a body", () => {
    render(
      <Table>
        <Reorder items={["a"]} onMove={() => {}} asChild>
          <TableBody>
            <ReorderItem id="a" name="A" asChild>
              <TableRow>
                <TableCell>A</TableCell>
              </TableRow>
            </ReorderItem>
          </TableBody>
        </Reorder>
      </Table>,
    );
    expect(status()?.parentElement?.getAttribute("data-slot")).toBe(
      "table-container",
    );
  });

  it("says where the row went once the move is taken", () => {
    render(<List />);
    fireEvent.click(button("Move Chat up"));
    expect(status()?.textContent).toBe("");
    frame();
    expect(status()?.textContent).toBe("Chat moved to position 2 of 3");
  });

  it("names the group in a list with groups", () => {
    render(<Groups />);
    fireEvent.click(button("Move Email down"));
    frame();
    expect(status()?.textContent).toBe(
      "Email moved to position 1 of 3 in If nobody answers",
    );
  });

  it("says nothing of a move the app did not take", () => {
    render(<List adopt="never" />);
    fireEvent.click(button("Move Chat up"));
    frame();
    expect(status()?.textContent).toBe("");
  });

  it("says it in the caller's words", () => {
    render(
      <List
        rules={{
          labels: {
            moveUp: (name) => `${name} nach oben`,
            moved: (name, position, count) =>
              `${name}: ${position} von ${count}`,
          },
        }}
      />,
    );
    fireEvent.click(button("Chat nach oben"));
    frame();
    expect(status()?.textContent).toBe("Chat: 2 von 3");
    expect(button("Move Chat down")).toBeDefined();
  });

  it("removes its live region with the list", () => {
    const { unmount } = render(<List />);
    expect(status()).not.toBeNull();
    unmount();
    expect(status()).toBeNull();
  });
});

describe("Reorder slides", () => {
  /** Every `transform` an element wore, in order, with the one it ends on. */
  function watchTransforms() {
    const seen = new Map<Element, string[]>();
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
      attributeOldValue: true,
    });
    return (el: Element) => {
      for (const record of observer.takeRecords()) {
        const list = seen.get(record.target as Element) ?? [];
        const old = /transform:\s*([^;]+)/.exec(record.oldValue ?? "")?.[1];
        if (old) list.push(old.trim());
        seen.set(record.target as Element, list);
      }
      return seen.get(el) ?? [];
    };
  }

  it("slides the rows that moved from where they were drawn", () => {
    layout.state.motion = true;
    render(<List />);
    const worn = watchTransforms();
    fireEvent.click(button("Move Push down"));
    const push = screen.getByTestId("push");
    const email = screen.getByTestId("email");
    expect(worn(push)).toContain(`translateY(-${H}px)`);
    expect(worn(email)).toContain(`translateY(${H}px)`);
    expect(push.style.transform).toBe("");
    expect(push.hasAttribute("data-shifting")).toBe(true);
    expect(worn(screen.getByTestId("chat"))).toEqual([]);
    act(() => vi.advanceTimersByTime(250));
    expect(push.hasAttribute("data-shifting")).toBe(false);
  });

  it("moves a row in a moving group by the difference only", () => {
    layout.state.motion = true;
    render(<Groups />);
    const worn = watchTransforms();
    fireEvent.click(button("Move Email down"));
    // Fallback's heading rose by Email's height; Email went from the first
    // group's end to under that heading.
    const fallback = document.querySelectorAll(
      '[data-slot="reorder-group"]',
    )[1];
    expect(worn(fallback)).toContain(`translateY(${H}px)`);
    const email = screen.getByTestId("email");
    // Drawn at HEAD + H, now at HEAD + H + HEAD in a group raised by H.
    expect(worn(email)).toContain(`translateY(${-HEAD - H}px)`);
    expect(worn(screen.getByTestId("chat"))).toContain(`translateY(-${H}px)`);
    const paused = document.querySelectorAll('[data-slot="reorder-group"]')[2];
    expect(worn(paused)).toEqual([]);
  });

  it("lets a move taken after a frame just appear", () => {
    layout.state.motion = true;
    render(<List adopt="later" />);
    const down = button("Move Push down");
    act(() => down.focus());
    fireEvent.click(down);
    frame();
    const worn = watchTransforms();
    act(() => later.take?.());
    expect(order()).toEqual(["email", "push", "chat"]);
    expect(worn(screen.getByTestId("push"))).toEqual([]);
    expect(worn(screen.getByTestId("email"))).toEqual([]);
    frame();
    expect(status()?.textContent).toBe("Push moved to position 2 of 3");
    expect(document.activeElement).toBe(button("Move Push down"));
  });

  it("does not wait on a slide that has no transition", () => {
    render(<List />);
    fireEvent.click(button("Move Push down"));
    expect(screen.getByTestId("push").hasAttribute("data-shifting")).toBe(
      false,
    );
  });
});

describe("Reorder drag", () => {
  // Rows in a list: push 0–30, email 30–60, chat 60–90. In groups: first
  // 0–80 (push 20–50, email 50–80), fallback 80–160 (chat 100–130, sms
  // 130–160), paused 160–210, empty.
  const handleOf = (id: string) =>
    screen
      .getByTestId(id)
      .querySelector('[data-slot="reorder-handle"]') as HTMLElement;
  const groupEl = (i: number) =>
    document.querySelectorAll('[data-slot="reorder-group"]')[i] as HTMLElement;
  let held: HTMLElement | undefined;

  function press(id: string, y: number, init: PointerEventInit = {}) {
    held = handleOf(id);
    fireEvent.pointerDown(held, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientY: y,
      ...init,
    });
  }
  const send = (type: string, y = 0, init: PointerEventInit = {}) =>
    act(() => {
      held?.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          clientY: y,
          bubbles: true,
          ...init,
        }),
      );
    });
  const moveTo = (y: number) => send("pointermove", y);
  const release = (y: number) => send("pointerup", y);
  const shiftOf = (el: Element) => (el as HTMLElement).style.transform;
  const row = (id: string) => screen.getByTestId(id);

  it("starts only past 4px, and a release before that does nothing", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(19);
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    release(19);
    expect(onMove).not.toHaveBeenCalled();
    expect(shiftOf(row("push"))).toBe("");
  });

  it.each([
    ["a row canMove holds", { canMove: (id: string) => id !== "push" }],
    ["a disabled list", { disabled: true }],
  ])("does not start on %s", (_, rules) => {
    render(<List rules={rules} />);
    press("push", 15);
    moveTo(60);
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
  });

  it("does not start in a list of one row, or on another button", () => {
    render(<List initial={["push"]} />);
    press("push", 15);
    moveTo(60);
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    release(60);
    cleanup();
    render(<List />);
    press("push", 15, { button: 2 });
    moveTo(60);
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
  });

  it("lifts the row, readies the rest to slide and shows the grabbing hand", () => {
    render(<Groups />);
    press("email", 65);
    moveTo(75);
    expect(row("email").hasAttribute("data-lifted")).toBe(true);
    expect(groupEl(0).hasAttribute("data-has-lifted")).toBe(true);
    expect(groupEl(1).hasAttribute("data-has-lifted")).toBe(false);
    expect(row("push").hasAttribute("data-shifting")).toBe(true);
    expect(groupEl(2).hasAttribute("data-shifting")).toBe(true);
    expect(row("email").hasAttribute("data-shifting")).toBe(false);
    expect(document.documentElement.style.cursor).toBe("grabbing");
    expect(shiftOf(row("email"))).toBe("translateY(10px)");
    release(75);
    expect(document.documentElement.style.cursor).toBe("");
  });

  it("makes room moving down in a list, and drops there", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(50);
    expect(shiftOf(row("push"))).toBe("translateY(35px)");
    expect(shiftOf(row("email"))).toBe(`translateY(-${H}px)`);
    expect(shiftOf(row("chat"))).toBe("");
    release(50);
    expect(onMove).toHaveBeenCalledWith({
      id: "push",
      from: { index: 0 },
      to: { index: 1 },
    });
    expect(order()).toEqual(["email", "push", "chat"]);
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    for (const id of ["push", "email", "chat"])
      expect(shiftOf(row(id))).toBe("");
  });

  it("makes room moving up in a list", () => {
    render(<List />);
    press("chat", 75);
    moveTo(40);
    expect(shiftOf(row("email"))).toBe(`translateY(${H}px)`);
    expect(shiftOf(row("push"))).toBe("");
    moveTo(5);
    expect(shiftOf(row("push"))).toBe(`translateY(${H}px)`);
  });

  it("reaches either end, and no further", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(500);
    expect(shiftOf(row("push"))).toBe(`translateY(${2 * H}px)`);
    release(500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { index: 2 } }),
    );
    act(() => vi.advanceTimersByTime(1));
    press("push", 75);
    moveTo(-500);
    expect(shiftOf(row("push"))).toBe(`translateY(-${2 * H}px)`);
    release(-500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { index: 0 } }),
    );
  });

  it("carries a row down into the next group", () => {
    const onMove = vi.fn();
    render(<Groups onMove={onMove} />);
    press("email", 65);
    moveTo(120);
    // Fallback rises a slot; its rows from the place on sink one back.
    expect(shiftOf(groupEl(1))).toBe(`translateY(-${H}px)`);
    expect(shiftOf(row("chat"))).toBe("");
    expect(shiftOf(row("sms"))).toBe(`translateY(${H}px)`);
    expect(shiftOf(groupEl(2))).toBe("");
    expect(shiftOf(row("email"))).toBe("translateY(55px)");
    release(120);
    expect(onMove).toHaveBeenCalledWith({
      id: "email",
      from: { group: "first", index: 1 },
      to: { group: "fallback", index: 1 },
    });
    expect(groupOrder()).toEqual([["push"], ["chat", "email", "sms"], []]);
  });

  it("carries a row up into the group above, against its own group's slide", () => {
    render(<Groups />);
    press("chat", 115);
    moveTo(55);
    // Fallback sinks a slot, Sms rises one back; Email makes room above.
    expect(shiftOf(groupEl(1))).toBe(`translateY(${H}px)`);
    expect(shiftOf(row("sms"))).toBe(`translateY(-${H}px)`);
    expect(shiftOf(row("email"))).toBe(`translateY(${H}px)`);
    expect(shiftOf(row("push"))).toBe("");
    // Halfway through its slide the group stands 12px down: Chat takes
    // that away to stay under the pointer.
    layout.state.sliding.set(groupEl(1), 12);
    frame();
    expect(shiftOf(row("chat"))).toBe("translateY(-72px)");
    expect(row("chat").getBoundingClientRect().top).toBe(100 - 60);
  });

  it("carries a row into an empty group", () => {
    const onMove = vi.fn();
    render(<Groups onMove={onMove} />);
    press("sms", 145);
    moveTo(195);
    expect(shiftOf(groupEl(2))).toBe(`translateY(-${H}px)`);
    release(195);
    expect(onMove).toHaveBeenCalledWith({
      id: "sms",
      from: { group: "fallback", index: 1 },
      to: { group: "paused", index: 0 },
    });
    expect(groupOrder()).toEqual([["push", "email"], ["chat"], ["sms"]]);
  });

  it("parts the groups at the middle of each heading", () => {
    const onMove = vi.fn();
    render(<Groups onMove={onMove} />);
    // Fallback's heading runs 80–100: its middle, 90, is the line, which
    // Push (20–50) crosses with its bottom edge and Chat (100–130) with its
    // top.
    press("push", 35);
    moveTo(35 + 39);
    expect(shiftOf(row("email"))).toBe(`translateY(-${H}px)`);
    expect(shiftOf(groupEl(1))).toBe("");
    moveTo(35 + 41);
    expect(shiftOf(groupEl(1))).toBe(`translateY(-${H}px)`);
    release(35 + 41);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { group: "fallback", index: 0 } }),
    );
    cleanup();
    render(<Groups onMove={onMove} />);
    press("chat", 115);
    moveTo(115 - 9);
    expect(shiftOf(groupEl(1))).toBe("");
    moveTo(115 - 11);
    expect(shiftOf(groupEl(1))).toBe(`translateY(${H}px)`);
    release(115 - 11);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { group: "first", index: 2 } }),
    );
  });

  it("finds the place by each row's own middle when heights differ", () => {
    const onMove = vi.fn();
    // push 0–30, email 30–90 (two lines), chat 90–120: Push's bottom edge
    // passes Email at 60.
    render(<List onMove={onMove} heights={{ email: 60 }} />);
    press("push", 15);
    moveTo(15 + 29);
    expect(shiftOf(row("email"))).toBe("");
    moveTo(15 + 31);
    expect(shiftOf(row("email"))).toBe(`translateY(-${H}px)`);
    release(15 + 31);
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ to: { index: 1 } }),
    );
  });

  it("reaches an end whose row is shorter, as a table body's last row is", () => {
    const onMove = vi.fn();
    // push 0–30, email 30–60, chat 60–89: no rule under the last row.
    render(<List onMove={onMove} heights={{ chat: H - 1 }} />);
    press("push", 15);
    moveTo(500);
    expect(shiftOf(row("chat"))).toBe(`translateY(-${H}px)`);
    release(500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { index: 2 } }),
    );
    cleanup();
    // push 0–29, email 29–59, chat 59–89.
    render(<List onMove={onMove} heights={{ push: H - 1 }} />);
    press("chat", 75);
    moveTo(-500);
    expect(shiftOf(row("push"))).toBe(`translateY(${H}px)`);
    release(-500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { index: 0 } }),
    );
  });

  // push 0–30, email 30–60, chat 60–160, sms 160–190, desk 190–220; chat
  // held at its middle, 110. Its top passes a row above at that row's
  // middle, its bottom a row below.
  it.each([
    [110 - 30, 1],
    [-500, 0],
    [110 + 30, 3],
    [500, 4],
  ])(
    "carries a row taller than the rest to every place: %i puts it at %i",
    (y, index) => {
      const onMove = vi.fn();
      render(
        <List
          initial={["push", "email", "chat", "sms", "desk"]}
          onMove={onMove}
          heights={{ chat: 100 }}
        />,
      );
      press("chat", 110);
      moveTo(y);
      release(y);
      expect(onMove).toHaveBeenCalledWith(
        expect.objectContaining({ to: { index } }),
      );
    },
  );

  it("carries a tall row into the group at either end", () => {
    const onMove = vi.fn();
    // first 0–80; fallback 80–230 (chat 100–130, sms 130–230); paused
    // 230–280, empty.
    render(<Groups onMove={onMove} heights={{ sms: 100 }} />);
    press("sms", 180);
    moveTo(500);
    release(500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { group: "paused", index: 0 } }),
    );
    cleanup();
    // first 0–80 (push 20–50, email 50–80); fallback 80–230 (chat 100–200).
    render(<Groups onMove={onMove} heights={{ chat: 100 }} />);
    press("chat", 150);
    moveTo(-500);
    release(-500);
    expect(onMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: { group: "first", index: 0 } }),
    );
  });

  it("holds the gap at the nearest place canDrop accepts", () => {
    const onMove = vi.fn();
    render(
      <List
        onMove={onMove}
        rules={{
          canMove: (id) => id !== "chat",
          canDrop: (_, to) => to.index < 2,
        }}
      />,
    );
    press("push", 15);
    moveTo(500);
    expect(shiftOf(row("email"))).toBe(`translateY(-${H}px)`);
    expect(shiftOf(row("chat"))).toBe("");
    release(500);
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ to: { index: 1 } }),
    );
  });

  it("hands over no move for a drop where the row started", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(25);
    release(25);
    expect(onMove).not.toHaveBeenCalled();
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    expect(shiftOf(row("push"))).toBe("");
  });

  it("slides everything back when the app does not take the drop", () => {
    layout.state.motion = true;
    const onMove = vi.fn();
    render(<List onMove={onMove} adopt="never" />);
    press("push", 15);
    moveTo(50);
    release(50);
    expect(onMove).toHaveBeenCalled();
    expect(shiftOf(row("email"))).toBe(`translateY(-${H}px)`);
    frame();
    expect(shiftOf(row("email"))).toBe("");
    expect(shiftOf(row("push"))).toBe("");
    expect(row("push").hasAttribute("data-shifting")).toBe(true);
    act(() => vi.advanceTimersByTime(250));
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    expect(order()).toEqual(["push", "email", "chat"]);
  });

  it("puts everything back on Escape, which nothing outside hears", () => {
    const onMove = vi.fn();
    const outside = vi.fn();
    document.addEventListener("keydown", outside);
    const onRowClick = vi.fn();
    render(<List onMove={onMove} onRowClick={onRowClick} />);
    press("push", 15);
    moveTo(50);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(outside).not.toHaveBeenCalled();
    expect(shiftOf(row("email"))).toBe("");
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    expect(document.documentElement.style.cursor).toBe("");
    // The release that follows moves nothing and opens nothing.
    release(50);
    fireEvent.click(handleOf("push"));
    expect(onMove).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outside);
  });

  it("puts everything back when the browser cancels the pointer", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(50);
    send("pointercancel");
    expect(shiftOf(row("email"))).toBe("");
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    release(50);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("gives up a drag when the order changes under it", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    press("push", 15);
    moveTo(50);
    act(() => later.set?.(["chat", "push", "email"]));
    expect(row("push").hasAttribute("data-lifted")).toBe(false);
    for (const id of ["push", "email", "chat"])
      expect(shiftOf(row(id))).toBe("");
    release(50);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("leaves nothing behind when it unmounts mid-drag", () => {
    const outside = vi.fn();
    document.addEventListener("keydown", outside);
    const { unmount } = render(<List />);
    press("push", 15);
    moveTo(50);
    unmount();
    expect(document.documentElement.style.cursor).toBe("");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(outside).toHaveBeenCalled();
    document.removeEventListener("keydown", outside);
  });

  it("keeps the click after a drag from reaching the row, and only that one", () => {
    const onRowClick = vi.fn();
    render(<List onRowClick={onRowClick} />);
    press("push", 15);
    moveTo(50);
    release(50);
    fireEvent.click(handleOf("push"));
    expect(onRowClick).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    press("push", 45);
    release(45);
    fireEvent.click(handleOf("push"));
    expect(onRowClick).toHaveBeenCalledWith("push");
  });

  it("scrolls its scroller near the edge, the row staying under the pointer", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `r${i}`);
    render(
      <div data-scroller style={{ overflowY: "auto" }}>
        <List initial={ids} />
      </div>,
    );
    press("r0", 15);
    moveTo(190);
    expect(row("r0").getBoundingClientRect().top).toBe(175);
    frame();
    expect(layout.state.scrollTop).toBe(14);
    frame();
    expect(layout.state.scrollTop).toBe(28);
    expect(row("r0").getBoundingClientRect().top).toBe(175);
    release(190);
  });
});
