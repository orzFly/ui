import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  NavList,
  NavListGroup,
  NavListGroupContent,
  NavListGroupRow,
  NavListGroupToggle,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "../src/components/nav-list.tsx";

interface Props {
  /** Which of the group's places is current, if any. */
  current?: "issues" | "board";
  group?: Omit<React.ComponentProps<typeof NavListGroup>, "children">;
  link?: React.ComponentProps<"a">;
  toggle?: Omit<React.ComponentProps<"button">, "type">;
}

/** A place group: a project whose row links to its overview, holding two pages. */
function PlaceGroup({ current, group, link, toggle }: Props) {
  return (
    <NavList>
      <NavListItem>
        <NavListGroup {...group}>
          <NavListGroupRow>
            <NavListLink href="#project" {...link}>
              Project
            </NavListLink>
            <NavListGroupToggle {...toggle} />
          </NavListGroupRow>
          <NavListGroupContent>
            <NavList>
              <NavListItem>
                <NavListLink
                  href="#issues"
                  depth={1}
                  current={current === "issues"}
                >
                  Issues
                </NavListLink>
              </NavListItem>
              <NavListItem>
                <NavListLink
                  href="#board"
                  depth={1}
                  current={current === "board"}
                >
                  Board
                </NavListLink>
              </NavListItem>
            </NavList>
          </NavListGroupContent>
        </NavListGroup>
      </NavListItem>
    </NavList>
  );
}

const groupOf = (container: HTMLElement) =>
  container.querySelector("[data-slot=nav-list-group]") as HTMLElement;
const contentOf = (container: HTMLElement) =>
  container.querySelector("[data-slot=nav-list-group-content]") as HTMLElement;
const toggle = () => screen.getByRole("button");

describe("NavListGroup", () => {
  it("is a disclosure: the toggle controls the content, which hides while closed", () => {
    const { container } = render(<PlaceGroup group={{ defaultOpen: false }} />);
    const content = contentOf(container);
    expect(toggle().getAttribute("aria-controls")).toBe(content.id);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(content.hidden).toBe(true);
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(content.hidden).toBe(false);
    fireEvent.click(toggle());
    expect(content.hidden).toBe(true);
  });

  it("names an icon-only toggle after its row's link", async () => {
    const { rerender } = render(<PlaceGroup />);
    await waitFor(() =>
      expect(toggle().getAttribute("aria-labelledby")).toBe(
        screen.getByRole("link", { name: "Project" }).id,
      ),
    );
    expect(toggle()).toHaveProperty("textContent", "");
    rerender(<PlaceGroup link={{ id: "project-link" }} />);
    await waitFor(() =>
      expect(toggle().getAttribute("aria-labelledby")).toBe("project-link"),
    );
    rerender(<PlaceGroup toggle={{ "aria-label": "Show the pages" }} />);
    expect(toggle().hasAttribute("aria-labelledby")).toBe(false);
  });

  describe("a plain click on the group's place", () => {
    const place = () => screen.getByRole("link", { name: "Project" });
    const stay = {
      onClick: (event: React.MouseEvent) => event.preventDefault(),
    };

    it("opens a closed group and never closes an open one", () => {
      render(<PlaceGroup group={{ defaultOpen: false }} link={stay} />);
      fireEvent.click(place());
      expect(toggle().getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(place());
      expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    it("opens it though a handler before took the click over", () => {
      const onClick = vi.fn((event: React.MouseEvent) =>
        event.preventDefault(),
      );
      render(<PlaceGroup group={{ defaultOpen: false }} link={{ onClick }} />);
      fireEvent.click(place());
      expect(onClick).toHaveBeenCalled();
      expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    it.each([
      ["a modified click", { ctrlKey: true }, {}],
      ["a middle click", { button: 1 }, {}],
      ["a link to another window", {}, { target: "_blank" }],
    ])("leaves it closed on %s", (_name, init, link) => {
      render(
        <PlaceGroup
          group={{ defaultOpen: false }}
          link={{ ...stay, ...link }}
        />,
      );
      fireEvent.click(place(), init);
      expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("until the reader chooses", () => {
    it("is open while it holds the current place", async () => {
      const { container, rerender } = render(<PlaceGroup current="issues" />);
      expect(groupOf(container).dataset.state).toBe("auto");
      expect(contentOf(container).hidden).toBe(false);
      await waitFor(() =>
        expect(toggle().getAttribute("aria-expanded")).toBe("true"),
      );
      rerender(<PlaceGroup />);
      await waitFor(() =>
        expect(toggle().getAttribute("aria-expanded")).toBe("false"),
      );
      rerender(<PlaceGroup current="board" />);
      await waitFor(() =>
        expect(toggle().getAttribute("aria-expanded")).toBe("true"),
      );
    });

    it("keeps the reader's choice once made", async () => {
      const { container, rerender } = render(<PlaceGroup current="issues" />);
      await waitFor(() =>
        expect(toggle().getAttribute("aria-expanded")).toBe("true"),
      );
      fireEvent.click(toggle());
      rerender(<PlaceGroup />);
      rerender(<PlaceGroup current="board" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(groupOf(container).dataset.state).toBe("closed");
      expect(contentOf(container).hidden).toBe(true);
      expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("starts from defaultOpen, as a choice already made", () => {
    const { container } = render(
      <PlaceGroup current="issues" group={{ defaultOpen: false }} />,
    );
    expect(groupOf(container).dataset.state).toBe("closed");
    expect(contentOf(container).hidden).toBe(true);
  });

  it("follows open when controlled, and asks onOpenChange", async () => {
    const onOpenChange = vi.fn();
    const { container, rerender } = render(
      <PlaceGroup group={{ open: false, onOpenChange }} />,
    );
    fireEvent.click(toggle());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(contentOf(container).hidden).toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    rerender(<PlaceGroup group={{ open: true, onOpenChange }} />);
    expect(contentOf(container).hidden).toBe(false);
    expect(groupOf(container).dataset.state).toBe("open");
    onOpenChange.mockClear();
    rerender(
      <PlaceGroup current="issues" group={{ open: false, onOpenChange }} />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("closed over the current place keeps it in the page, current, and marks no head current", () => {
    const { container } = render(
      <PlaceGroup current="issues" group={{ defaultOpen: false }} />,
    );
    expect(groupOf(container).dataset.state).toBe("closed");
    const issues = contentOf(container).querySelector("[aria-current]");
    expect(issues?.textContent).toBe("Issues");
    const row = container.querySelector("[data-slot=nav-list-group-row]");
    expect(row?.querySelector("[aria-current]")).toBeNull();
  });

  it("renders on the server open over the current place, closed by defaultOpen", () => {
    const auto = document.createElement("div");
    auto.innerHTML = renderToString(<PlaceGroup current="issues" />);
    expect(groupOf(auto).dataset.state).toBe("auto");
    expect(contentOf(auto).hasAttribute("hidden")).toBe(false);

    const closed = document.createElement("div");
    closed.innerHTML = renderToString(
      <PlaceGroup current="issues" group={{ defaultOpen: false }} />,
    );
    expect(contentOf(closed).hasAttribute("hidden")).toBe(true);
  });

  it("heads a group with a heading whose whole text toggles it", () => {
    render(
      <NavListGroup defaultOpen>
        <NavListHeading asChild>
          <h2>
            <NavListGroupToggle>Labels</NavListGroupToggle>
          </h2>
        </NavListHeading>
        <NavListGroupContent>
          <NavList>
            <NavListItem>
              <NavListLink href="#work">Work</NavListLink>
            </NavListItem>
          </NavList>
        </NavListGroupContent>
      </NavListGroup>,
    );
    const labels = screen.getByRole("button", { name: "Labels" });
    expect(labels.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(labels);
    expect(labels.getAttribute("aria-expanded")).toBe("false");
  });

  it("leaves the group as it is when the toggle's own handler prevents the default", () => {
    render(
      <PlaceGroup
        group={{ defaultOpen: false }}
        toggle={{ onClick: (event) => event.preventDefault() }}
      />,
    );
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it.each([
    ["NavListGroupRow", <NavListGroupRow key="a" />],
    ["NavListGroupToggle", <NavListGroupToggle key="a" />],
    ["NavListGroupContent", <NavListGroupContent key="a" />],
  ])("%s throws outside a NavListGroup", (part, element) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(element)).toThrow(
      `${part} renders inside a NavListGroup`,
    );
    vi.restoreAllMocks();
  });
});
