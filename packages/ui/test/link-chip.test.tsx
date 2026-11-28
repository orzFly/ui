import { render, screen } from "@testing-library/react";
import { FileTextIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import {
  LinkChip,
  RICH_CHIP_ICON,
  RICH_CHIP_SKIN,
  RICH_CHIP_STRUCTURE,
} from "../src/components/link-chip.tsx";

const SKIN = RICH_CHIP_SKIN.split(" ")[0] as string;

describe("LinkChip", () => {
  it("is an anchor that truncates its own label", () => {
    render(<LinkChip href="https://app.example/a">notes</LinkChip>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://app.example/a");
    expect(link.getAttribute("data-slot")).toBe("link-chip");
    expect(link.classList.contains("text-ellipsis")).toBe(true);
    expect((link.lastElementChild as HTMLElement).textContent).toBe("notes");
  });

  // UI-292: a flex or grid chip makes each of its children a block, which
  // Chromium copies on a line of its own.
  it("lays out nothing inside it as a block", () => {
    const display = RICH_CHIP_STRUCTURE.split(" ").filter((c) =>
      /^(inline-)?(block|flex|grid)$/.test(c),
    );
    expect(display).toEqual(["inline-block"]);
  });

  it("underlines on hover unless boxed", () => {
    const { rerender } = render(<LinkChip href="#">plain</LinkChip>);
    const link = screen.getByRole("link");
    expect(link.classList.contains("hover:underline")).toBe(true);
    expect(link.classList.contains(SKIN)).toBe(false);
    rerender(
      <LinkChip href="#" boxed>
        plain
      </LinkChip>,
    );
    expect(link.classList.contains(SKIN)).toBe(true);
    expect(link.classList.contains("hover:underline")).toBe(false);
  });

  it("draws the icon before the label", () => {
    render(
      <LinkChip href="#" icon={FileTextIcon}>
        notes
      </LinkChip>,
    );
    const icon = screen.getByRole("link").firstElementChild as Element;
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("class")).toContain(RICH_CHIP_ICON);
  });

  it("with asChild, renders the child element as the chip", () => {
    function RouterLink({
      to,
      ...props
    }: ComponentProps<"a"> & { to: string }) {
      return <a data-router href={`/app${to}`} {...props} />;
    }
    render(
      <LinkChip asChild boxed icon={FileTextIcon} className="font-medium">
        <RouterLink to="/issues/7">Issue 7</RouterLink>
      </LinkChip>,
    );
    const link = screen.getByRole("link");
    expect(link.hasAttribute("data-router")).toBe(true);
    expect(link.getAttribute("href")).toBe("/app/issues/7");
    expect(link.classList.contains(SKIN)).toBe(true);
    expect(link.classList.contains("font-medium")).toBe(true);
    expect(link.querySelector("svg")).not.toBeNull();
    expect((link.lastElementChild as HTMLElement).textContent).toBe("Issue 7");
  });
});
