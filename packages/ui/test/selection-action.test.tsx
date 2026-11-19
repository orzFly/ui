import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SelectionAction,
  SelectionActionProvider,
  useSelectionRegion,
} from "../src/components/selection-action.tsx";
import { POINTER_FINE } from "../src/hooks/use-media-query.ts";

/** One timeline entry: a header outside the region, and the body inside it. */
function Entry({ id, body }: { id: string; body: string }) {
  const region = useSelectionRegion(id);
  return (
    <article data-testid={id}>
      <header>{id} wrote</header>
      <div ref={region}>
        <p>{body}</p>
      </div>
    </article>
  );
}

function mount() {
  const onQuote = vi.fn();
  const view = render(
    <SelectionActionProvider>
      <Entry id="first" body="Alpha beta gamma." />
      <Entry id="second" body="Zeta eta." />
      <SelectionAction<string>>
        {({ text, value, dismiss }) => (
          <button
            type="button"
            onClick={() => {
              onQuote(value, text);
              dismiss();
            }}
          >
            Quote reply
          </button>
        )}
      </SelectionAction>
    </SelectionActionProvider>,
  );
  return { view, onQuote };
}

function select(start: Node, from: number, end: Node, to: number): void {
  const range = document.createRange();
  range.setStart(start, from);
  range.setEnd(end, to);
  const selection = window.getSelection();
  if (!selection) throw new Error("no selection support");
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Lets the frame-batched read run, so "still absent" means something. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function textOf(id: string, selector: string): Node {
  const node = screen.getByTestId(id).querySelector(selector)?.firstChild;
  if (!node) throw new Error(`no text under ${selector}`);
  return node;
}

const action = () => screen.queryByRole("button", { name: "Quote reply" });

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
});

describe("SelectionAction", () => {
  it("acts on text selected inside one region, with that region's value", async () => {
    const { onQuote } = mount();
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    fireEvent.click(await screen.findByRole("button", { name: "Quote reply" }));
    expect(onQuote).toHaveBeenCalledWith("first", "Alpha");
    await waitFor(() => expect(action()).toBeNull());
  });

  it("stays away when the selection runs into the next region", async () => {
    mount();
    select(textOf("first", "p"), 0, textOf("second", "p"), 4);
    await settle();
    expect(action()).toBeNull();
  });

  it("stays away when the selection reaches out of its region", async () => {
    mount();
    select(textOf("first", "header"), 0, textOf("first", "p"), 4);
    await settle();
    expect(action()).toBeNull();
  });

  it("survives its own press collapsing the selection", async () => {
    const { onQuote } = mount();
    const zeta = textOf("second", "p");
    select(zeta, 0, zeta, 4);
    const button = await screen.findByRole("button", { name: "Quote reply" });
    fireEvent.pointerDown(button);
    window.getSelection()?.removeAllRanges();
    fireEvent.pointerUp(button);
    await settle();
    fireEvent.click(button);
    expect(onQuote).toHaveBeenCalledWith("second", "Zeta");
  });

  it("goes once the selection does", async () => {
    mount();
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    await screen.findByRole("button", { name: "Quote reply" });
    window.getSelection()?.removeAllRanges();
    await waitFor(() => expect(action()).toBeNull());
  });

  it("waits for a drag to end before it shows", async () => {
    mount();
    fireEvent.pointerDown(screen.getByTestId("first"));
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    await settle();
    expect(action()).toBeNull();
    fireEvent.pointerUp(screen.getByTestId("first"));
    expect(
      await screen.findByRole("button", { name: "Quote reply" }),
    ).toBeTruthy();
  });

  it("floats beside the selection for a mouse", async () => {
    mount();
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    const button = await screen.findByRole("button", { name: "Quote reply" });
    expect(button.parentElement?.className).toContain("fixed");
    expect(button.parentElement?.className).toContain("-translate-x-full");
  });

  it("is a bar along the window's foot for touch", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query !== POINTER_FINE,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    mount();
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    const button = await screen.findByRole("button", { name: "Quote reply" });
    const bar = button.parentElement;
    expect(bar?.getAttribute("data-purpose")).toBe("toolbar");
    expect(bar?.className).toContain("bottom-0");
  });

  it("acts on nothing outside a provider", async () => {
    render(
      <>
        <Entry id="first" body="Alpha beta gamma." />
        <SelectionAction>
          {() => <button type="button">Quote reply</button>}
        </SelectionAction>
      </>,
    );
    const alpha = textOf("first", "p");
    select(alpha, 0, alpha, 5);
    await settle();
    expect(action()).toBeNull();
  });
});
