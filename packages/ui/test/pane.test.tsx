import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { Pane } from "../src/components/pane.tsx";

// The default style's classes alone: raymond's are its own business.
const classes = (props: ComponentProps<typeof Pane>) => {
  const { container } = render(<Pane {...props} />);
  return (container.firstElementChild as HTMLElement).className
    .split(" ")
    .filter((each) => !each.startsWith("raymond:"));
};

describe("Pane", () => {
  it("rules off the edge it is given", () => {
    expect(classes({ purpose: "toolbar", edge: "bottom" })).toContain(
      "border-b",
    );
    expect(classes({ purpose: "panel" }).join(" ")).not.toMatch(/border/);
  });

  it("moves its edge from one breakpoint up, taking the earlier one away", () => {
    const got = classes({
      purpose: "panel",
      edge: { initial: "bottom", md: "end" },
    });
    expect(got).toEqual(
      expect.arrayContaining(["border-b", "md:border-b-0", "md:border-e"]),
    );
  });

  it("draws no edge below the first breakpoint it is given at", () => {
    const got = classes({ purpose: "panel", edge: { md: "end" } });
    expect(got).toContain("md:border-e");
    expect(got).not.toContain("border-e");
  });

  it("fills a sidebar only where it stands beside the rest", () => {
    const stacked = classes({
      purpose: "sidebar",
      edge: { initial: "bottom", md: "end" },
    });
    expect(stacked).toContain("md:bg-sidebar");
    expect(stacked).not.toContain("bg-sidebar");
    expect(classes({ purpose: "sidebar" })).not.toContain("bg-sidebar");
    expect(
      classes({ purpose: "sidebar", edge: { initial: "end", lg: "top" } }),
    ).toEqual(
      expect.arrayContaining([
        "bg-sidebar",
        "lg:bg-transparent",
        "lg:border-t",
      ]),
    );
  });

  it("hands a filled sidebar's state fill to what it holds, and the page's back where it stops", () => {
    const filled = classes({
      purpose: "sidebar",
      edge: { initial: "bottom", md: "end", xl: "top" },
    });
    expect(filled).toEqual(
      expect.arrayContaining([
        "md:[--accent:var(--sidebar-accent)]",
        "md:[--accent-foreground:var(--sidebar-accent-foreground)]",
        "xl:[--accent:inherit]",
        "xl:[--accent-foreground:inherit]",
      ]),
    );
    expect(filled).not.toContain("[--accent:var(--sidebar-accent)]");
  });

  it("frames only a window, dropping the frame on the edge it is docked against", () => {
    expect(classes({ purpose: "window" })).toEqual(
      expect.arrayContaining(["rounded-overlay", "border"]),
    );
    expect(
      classes({ purpose: "window", docked: { initial: "fill", md: "bottom" } }),
    ).toEqual(
      expect.arrayContaining([
        "rounded-none",
        "border-0",
        "md:rounded-b-none",
        "md:border-b-0",
      ]),
    );
    expect(
      classes({ purpose: "panel", docked: "bottom" }).join(" "),
    ).not.toMatch(/rounded|border/);
  });
});
