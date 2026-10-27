import { act, render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../src/components/sheet.tsx";
import { Toaster } from "../src/components/sonner.tsx";

type Side = "top" | "right" | "bottom" | "left";

const EDGE = { top: "t", right: "r", bottom: "b", left: "l" } as const;

/** The edges a sheet on each side touches: its own and the two beside it. */
const TOUCHES: Record<Side, Side[]> = {
  top: ["top", "right", "left"],
  right: ["top", "right", "bottom"],
  bottom: ["right", "bottom", "left"],
  left: ["top", "bottom", "left"],
};

function sheetClasses(side: Side, className?: string) {
  render(
    <Sheet open>
      <SheetContent side={side} className={className}>
        <SheetTitle>Title</SheetTitle>
        <SheetDescription>Description</SheetDescription>
      </SheetContent>
    </Sheet>,
  );
  const content = document.querySelector('[data-slot="sheet-content"]');
  if (content === null) throw new Error("no sheet content");
  return content.className.split(/\s+/);
}

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe("SheetContent safe area", () => {
  for (const side of Object.keys(TOUCHES) as Side[]) {
    it(`insets a ${side} sheet on the edges it touches, under a className's padding`, () => {
      const classes = sheetClasses(side, "p-2 pb-8");
      for (const edge of ["top", "right", "bottom", "left"] as Side[]) {
        const inset = `data-[side=${side}]:border-${EDGE[edge]}-[length:env(safe-area-inset-${edge})]`;
        if (TOUCHES[side].includes(edge)) expect(classes).toContain(inset);
        else expect(classes).not.toContain(inset);
      }
      expect(classes).toContain("p-2");
    });
  }
});

describe("Toaster safe area", () => {
  async function toasterStyle() {
    act(() => {
      toast("Saved");
    });
    return await waitFor(() => {
      const list = document.querySelector<HTMLElement>("[data-sonner-toaster]");
      if (list === null) throw new Error("no toast list yet");
      return list.style;
    });
  }

  it("adds the insets to sonner's own offsets", async () => {
    render(<Toaster />);
    const style = await toasterStyle();
    expect(style.getPropertyValue("--offset-bottom")).toBe(
      "calc(24px + env(safe-area-inset-bottom))",
    );
    expect(style.getPropertyValue("--mobile-offset-left")).toBe(
      "calc(16px + env(safe-area-inset-left))",
    );
  });

  it("takes an app's own offset over its own", async () => {
    render(<Toaster offset={40} />);
    const style = await toasterStyle();
    expect(style.getPropertyValue("--offset-bottom")).toBe("40px");
  });
});
