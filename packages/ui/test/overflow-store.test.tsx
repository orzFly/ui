import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import { foldSteps } from "../src/components/overflow/fold.ts";
import { OverflowMenu } from "../src/components/overflow/menu.tsx";
import { useOverflowPart } from "../src/components/overflow/part.ts";
import { useOverflowRoot } from "../src/components/overflow/root.ts";
import {
  type OverflowResult,
  OverflowStore,
  type PartMeta,
  type PlanInput,
  type RowChild,
} from "../src/components/overflow/store.ts";
import {
  OUT_OF_FLOW,
  outerWidth,
  slotProps,
} from "../src/components/overflow/util.ts";
import { stubToolbarLayout } from "./stub-toolbar-layout.ts";

interface TestMeta extends PartMeta {
  name: string;
}

/** Folds from the end, the ⋯ beside what is left; `flip` answers the opposite of the last layout. */
class TestStore extends OverflowStore<TestMeta, OverflowResult> {
  flip = false;

  constructor() {
    super({ views: {}, overflow: [], breaks: [] });
  }

  protected plan({
    available,
    gap,
    children,
  }: PlanInput<TestMeta>): OverflowResult {
    const shown = children.filter((child) => !child.hidden);
    const width = (child: RowChild<TestMeta>) =>
      Math.ceil(
        child.record
          ? child.record.measure(child.view, child.el).width
          : outerWidth(child.el),
      );
    const trigger = this.triggerRef.current
      ? Math.ceil(outerWidth(this.triggerRef.current))
      : 0;
    const views: Record<string, string> = {};
    for (const child of shown) if (child.record) views[child.id] = "bar";
    const steps = shown
      .filter((child) => child.record?.meta.overflowable)
      .reverse()
      .map((child, i) => ({ key: [i], ids: [child.id], view: "overflow" }));
    const fits = (current: Readonly<Record<string, string>>) => {
      let sum = 0;
      let count = 0;
      let folded = false;
      for (const child of shown) {
        if (current[child.id] === "overflow") folded = true;
        else {
          sum += width(child);
          count++;
        }
      }
      if (folded) {
        sum += trigger;
        count++;
      }
      return sum + gap * Math.max(count - 1, 0) <= available;
    };
    let folded = foldSteps(views, steps, fits).views;
    if (this.flip && this.result.overflow.length > 0) {
      folded = { ...views };
    }
    return {
      views: folded,
      overflow: shown
        .filter((child) => folded[child.id] === "overflow")
        .map((child) => child.id),
      breaks: [],
    };
  }
}

function Part({ store, name }: { store: TestStore; name: string }) {
  const part = useOverflowPart<TestMeta>({
    store,
    enabled: true,
    kind: "test",
    meta: {
      overflowable: true,
      name,
      renderOverflow: () => <DropdownMenuItem>{name}</DropdownMenuItem>,
    },
  });
  const overflowed = part.view === "overflow";
  return (
    <button
      ref={part.ref}
      type="button"
      {...slotProps(overflowed)}
      className={overflowed ? OUT_OF_FLOW : undefined}
    >
      {name}
    </button>
  );
}

function Row({
  store,
  children,
}: {
  store: TestStore;
  children: React.ReactNode;
}) {
  useOverflowRoot(store);
  const open = React.useSyncExternalStore(
    store.subscribe,
    () => store.overflowOpen,
    () => false,
  );
  const rowRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      store.row = el;
      if (!el) return;
      store.observe(el);
      return () => {
        store.unobserve(el);
        store.row = null;
      };
    },
    [store],
  );
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => store.setOverflowOpen(next)}
    >
      <div ref={rowRef} data-slot="test-row">
        {children}
        <DropdownMenuTrigger asChild>
          <button
            ref={store.triggerRef}
            type="button"
            aria-label="More"
            data-overflow-internal=""
            data-test-width="20"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
      </div>
      <OverflowMenu store={store} align="start" data-slot="test-menu" />
    </DropdownMenu>
  );
}

let layout: ReturnType<typeof stubToolbarLayout>;
beforeEach(() => {
  layout = stubToolbarLayout(1000, "test-row");
});
afterEach(() => layout.restore());

const settle = () => act(async () => {});

const part = (name: string) =>
  screen.getByRole("button", { name, hidden: true });

const folded = (name: string) => part(name).hasAttribute("data-overflowed");

/** Alpha 35, Beta 28, Gamma 35, Delta 35: 133 in all, the ⋯ 20. */
function renderRow(store: TestStore, fixed = false) {
  return render(
    <Row store={store}>
      <Part store={store} name="Alpha" />
      {fixed && <span>Fixed</span>}
      <Part store={store} name="Beta" />
      <Part store={store} name="Gamma" />
      <Part store={store} name="Delta" />
    </Row>,
  );
}

async function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "More" }), {
    key: "Enter",
  });
  await settle();
  return [...document.querySelectorAll("[role=menu] [role=menuitem]")].map(
    (item) => item.textContent,
  );
}

describe("OverflowStore", () => {
  it("holds a folded part's place out of sight, inert and out of the flow", async () => {
    const store = new TestStore();
    renderRow(store);
    await settle();
    expect(folded("Delta")).toBe(false);
    // Delta out leaves 98 and the ⋯ 20; Gamma out too, 63 and 20.
    await layout.resize(100);
    expect(folded("Alpha")).toBe(false);
    expect(folded("Beta")).toBe(false);
    expect(folded("Gamma")).toBe(true);
    expect(folded("Delta")).toBe(true);
    expect(part("Delta")).toHaveProperty("inert", true);
    expect(part("Delta").className).toContain("absolute");
    await layout.resize(1000);
    expect(folded("Delta")).toBe(false);
    expect(part("Delta")).toHaveProperty("inert", false);
  });

  it("counts a child it does not know at its width, and never folds it", async () => {
    const store = new TestStore();
    renderRow(store, true);
    await settle();
    // With Fixed's 35 counted, Gamma out leaves 98 and 20, Beta too 70 and 20.
    await layout.resize(90);
    expect(folded("Alpha")).toBe(false);
    expect(folded("Beta")).toBe(true);
    expect(folded("Gamma")).toBe(true);
    expect(screen.getByText("Fixed").hasAttribute("data-overflowed")).toBe(
      false,
    );
    // The ⋯ is the row's own: not counted as a child, only as the ⋯.
    expect(store.result.overflow).toHaveLength(3);
  });

  it("hands the focus to the ⋯ when the part holding it folds", async () => {
    const store = new TestStore();
    renderRow(store);
    await settle();
    act(() => part("Delta").focus());
    await layout.resize(100);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "More" }),
    );
  });

  it("draws the folded parts in the menu, in row order", async () => {
    const store = new TestStore();
    renderRow(store);
    await settle();
    await layout.resize(100);
    expect(await openMenu()).toEqual(["Gamma", "Delta"]);
  });

  it("closes the menu once nothing is folded", async () => {
    const store = new TestStore();
    renderRow(store);
    await settle();
    await layout.resize(100);
    await openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
    await layout.resize(1000);
    await settle();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(store.overflowOpen).toBe(false);
  });

  it("keeps the more folded of two answers that alternate", async () => {
    const store = new TestStore();
    renderRow(store);
    await settle();
    await layout.resize(100);
    store.flip = true;
    for (let i = 0; i < 4; i++) await act(async () => store.solve());
    expect(store.result.overflow).toHaveLength(2);
    expect(folded("Delta")).toBe(true);
  });
});
