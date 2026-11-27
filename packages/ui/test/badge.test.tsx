import { TAG_FILL } from "@orz/themes";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../src/components/badge.tsx";

const plainMarker = () => {
  render(<Badge variant="marker">plain</Badge>);
  return screen.getByText("plain").className;
};

describe("Badge", () => {
  it("draws marker in the module marker's colours, its fill kept under raymond's static edge", () => {
    render(<Badge variant="marker">3</Badge>);
    const badge = screen.getByText("3");
    expect(badge.dataset.variant).toBe("marker");
    const classes = badge.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-marker",
        "text-primary",
        "border-primary/35",
        "raymond:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]",
        "raymond:bg-marker",
        "raymond:dark:bg-marker",
      ]),
    );
    expect(classes).not.toContain("raymond:bg-transparent");
    expect(classes).not.toContain("raymond:dark:bg-transparent");
  });

  it("draws a named tag colour from the theme's token", () => {
    render(
      <Badge variant="marker" color="red">
        bug
      </Badge>,
    );
    const badge = screen.getByText("bug");
    expect(badge.dataset.variant).toBe("marker");
    expect(badge.dataset.color).toBe("red");
    expect(badge.style.getPropertyValue("--tag-ink")).toBe("var(--tag-red)");
    const classes = badge.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "text-(color:--tag-ink)!",
        "border-(color:--tag-ink)/35",
        "raymond:bg-transparent",
        "raymond:text-inherit!",
        "raymond:before:bg-(color:--tag-ink)",
      ]),
    );
    expect(classes).not.toContain("bg-marker");
    expect(classes).not.toContain("text-primary");
    expect(classes.some((c) => c.startsWith("raymond:shadow-[inset"))).toBe(
      false,
    );
  });

  it("mixes its fill into the page by the theme's tag fill share", () => {
    render(
      <Badge variant="marker" color="blue">
        docs
      </Badge>,
    );
    const classes = screen.getByText("docs").className;
    expect(classes).toContain(
      `bg-[color-mix(in_oklab,var(--tag-ink)_${TAG_FILL.light * 100}%,var(--background))]`,
    );
    expect(classes).toContain(
      `dark:bg-[color-mix(in_oklab,var(--tag-ink)_${TAG_FILL.dark * 100}%,var(--background))]`,
    );
  });

  it("draws any other colour value from the theme's tag colours", () => {
    render(
      <Badge variant="marker" color="#d73a4a">
        bug
      </Badge>,
    );
    const badge = screen.getByText("bug");
    expect(badge.dataset.color).toBe("value");
    expect(badge.style.getPropertyValue("--tag-ink")).toMatch(/^color-mix\(/);
  });

  it("draws a value that does not parse as no colour at all", () => {
    const plain = plainMarker();
    render(
      <Badge variant="marker" color="var(--x)">
        odd
      </Badge>,
    );
    const badge = screen.getByText("odd");
    expect(badge.dataset.color).toBeUndefined();
    expect(badge.style.getPropertyValue("--tag-ink")).toBe("");
    expect(badge.className).toBe(plain);
  });

  it("keeps the caller's style after its own", () => {
    render(
      <Badge variant="marker" color="teal" style={{ marginLeft: 4 }}>
        ci
      </Badge>,
    );
    const badge = screen.getByText("ci");
    expect(badge.style.marginLeft).toBe("4px");
    expect(badge.style.getPropertyValue("--tag-ink")).toBe("var(--tag-teal)");
  });

  it("takes a colour on marker alone", () => {
    // @ts-expect-error: only a marker takes a tag colour.
    render(<Badge variant="outline" color="red" />);
  });
});
