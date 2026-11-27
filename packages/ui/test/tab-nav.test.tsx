import { act, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabNav, TabNavLink } from "../src/components/tab-nav.tsx";
import { stubToolbarLayout } from "./stub-toolbar-layout.ts";

let layout: ReturnType<typeof stubToolbarLayout>;
beforeEach(() => {
  layout = stubToolbarLayout(1000, "tab-nav");
});
afterEach(() => layout.restore());

const settle = () => act(async () => {});

const SECTIONS = ["List", "Board", "Insights", "Settings"];

/** List 28, Board 35, Insights 56, Settings 56: 175 in all; the ⋯ 16. */
function Sections({
  current = "Board",
  onClick,
  ...props
}: React.ComponentProps<typeof TabNav> & {
  current?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <TabNav aria-label="Sections" {...props}>
      {SECTIONS.map((name) => (
        <TabNavLink
          key={name}
          id={`${name.toLowerCase()}-tab`}
          href={`/${name.toLowerCase()}`}
          current={name === current}
          className="caller-class"
          onClick={onClick}
        >
          {name}
        </TabNavLink>
      ))}
    </TabNav>
  );
}

// A folded link is aria-hidden, which leaves it no accessible name to find it by.
const link = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-slot=tab-nav-link]")].find(
    (el) => el.textContent === name,
  ) as HTMLElement;
const folded = (name: string) => link(name).hasAttribute("data-overflowed");
const more = () =>
  document.querySelector<HTMLElement>(
    "[data-slot=tab-nav-overflow-trigger]",
  ) as HTMLElement;
const nav = () => screen.getByRole("navigation");

async function openMenu() {
  fireEvent.keyDown(more(), { key: "Enter" });
  await settle();
  return [
    ...document.querySelectorAll<HTMLElement>("[role=menu] [role=menuitem]"),
  ];
}

describe("TabNav", () => {
  it("folds the links that do not fit into the ⋯, from the end, and brings them back", async () => {
    render(<Sections />);
    await settle();
    expect(more()).toHaveProperty("inert", true);
    // Settings out leaves 119 and 16; Insights too, 63 and 16.
    await layout.resize(120);
    expect(SECTIONS.map(folded)).toEqual([false, false, true, true]);
    expect(link("Settings")).toHaveProperty("inert", true);
    expect(link("Settings").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(more()).toHaveProperty("inert", false);
    expect(nav().lastElementChild).toBe(more());
    expect(screen.getByRole("button", { name: "More sections" })).toBe(more());
    await layout.resize(1000);
    expect(SECTIONS.map(folded)).toEqual([false, false, false, false]);
    expect(more()).toHaveProperty("inert", true);
  });

  it("passes over the current link, and marks the ⋯ once it folds it too", async () => {
    render(<Sections current="Insights" />);
    await settle();
    // Settings, then Board, then List: Insights and the ⋯ are 72.
    await layout.resize(80);
    expect(SECTIONS.map(folded)).toEqual([true, true, false, true]);
    expect(more().hasAttribute("data-current")).toBe(false);
    await layout.resize(71);
    expect(SECTIONS.map(folded)).toEqual([true, true, true, true]);
    expect(more().hasAttribute("data-current")).toBe(true);
    expect(more().getAttribute("aria-label")).toBe(
      "More sections (current: Insights)",
    );
  });

  it("takes the ⋯'s names from its props", async () => {
    render(
      <Sections
        overflowLabel="More"
        overflowCurrentLabel={(current) => `More, at ${current}`}
      />,
    );
    await settle();
    await layout.resize(120);
    expect(more().getAttribute("aria-label")).toBe("More");
    await layout.resize(20);
    expect(more().getAttribute("aria-label")).toBe("More, at Board");
  });

  it("lists the folded links in the menu as the same links, in order, the current one marked", async () => {
    render(<Sections />);
    await settle();
    await layout.resize(20);
    const rows = await openMenu();
    expect(rows.map((row) => row.textContent)).toEqual(SECTIONS);
    for (const row of rows) {
      expect(row.tagName).toBe("A");
      expect(row.getAttribute("href")).toBe(
        `/${row.textContent?.toLowerCase()}`,
      );
      // The row's own class and id stay on the row.
      expect(row.classList.contains("caller-class")).toBe(false);
      expect(row.id).toBe("");
    }
    expect(rows.map((row) => row.getAttribute("aria-current"))).toEqual([
      null,
      "page",
      null,
      null,
    ]);
    expect(
      rows[1]?.querySelector("[data-slot=tab-nav-menu-mark]"),
    ).not.toBeNull();
  });

  it("draws a router's link in the menu under asChild", async () => {
    function RouterLink({
      to,
      ...props
    }: React.ComponentProps<"a"> & { to: string }) {
      return <a href={to} data-router-link="" {...props} />;
    }
    render(
      <TabNav aria-label="Sections">
        <TabNavLink asChild current>
          <RouterLink to="/list">List</RouterLink>
        </TabNavLink>
        <TabNavLink asChild>
          <RouterLink to="/board">Board</RouterLink>
        </TabNavLink>
      </TabNav>,
    );
    await settle();
    await layout.resize(10);
    const rows = await openMenu();
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/list",
      "/board",
    ]);
    expect(rows.every((row) => row.hasAttribute("data-router-link"))).toBe(
      true,
    );
    expect(rows[0]?.getAttribute("aria-current")).toBe("page");
    expect(rows[0]?.textContent).toBe("List");
    expect(more().getAttribute("aria-label")).toBe(
      "More sections (current: List)",
    );
  });

  it("hands a click in the menu to the link's onClick, and closes on a plain one", async () => {
    const clicked: Array<Element | null> = [];
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => {
      clicked.push(event.currentTarget);
      event.preventDefault();
    });
    render(<Sections onClick={onClick} />);
    await settle();
    await layout.resize(120);
    const rows = await openMenu();
    expect(rows.map((row) => row.textContent)).toEqual([
      "Insights",
      "Settings",
    ]);
    fireEvent.click(rows[0] as HTMLElement);
    await settle();
    expect(clicked).toEqual([rows[0]]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu once every link fits again", async () => {
    render(<Sections />);
    await settle();
    await layout.resize(120);
    await openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
    await layout.resize(1000);
    await settle();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("hands the focus to the ⋯ when the link holding it folds", async () => {
    render(<Sections />);
    await settle();
    act(() => link("Settings").focus());
    await layout.resize(120);
    expect(document.activeElement).toBe(more());
  });

  it("sizes its box from its links once measured", async () => {
    render(<Sections />);
    await settle();
    const classes = nav().className.split(/\s+/);
    expect(classes).toContain("basis-0");
    expect(classes).toContain("grow-1000");
    expect(classes).not.toContain("overflow-x-clip");
    expect(nav().style.getPropertyValue("--tab-nav-full")).toBe("175px");
    // Board and the ⋯.
    expect(nav().style.getPropertyValue("--tab-nav-least")).toBe("51px");
  });

  it("takes no flex size in a flex column, where it would be its height", async () => {
    render(
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Sections />
      </div>,
    );
    await settle();
    const classes = nav().className.split(/\s+/);
    expect(classes).not.toContain("grow-1000");
    expect(classes).not.toContain("basis-0");
    expect(classes).toContain("w-(--tab-nav-full)");
  });

  it("lets the caller's flex win over its own", async () => {
    render(<Sections className="flex-1" />);
    await settle();
    const classes = nav().className.split(/\s+/);
    expect(classes).toContain("flex-1");
    expect(classes).not.toContain("grow-1000");
  });

  it("keeps its links on one line, cut off, and no ⋯ in sight before it is measured", () => {
    const html = renderToString(<Sections />);
    const host = document.createElement("div");
    host.innerHTML = html;
    const box = host.querySelector("nav") as HTMLElement;
    expect(box.className).toContain("min-w-0");
    expect(box.className).toContain("overflow-x-clip");
    expect(box.className).not.toContain("flex-wrap");
    const trigger = host.querySelector(
      "[data-slot=tab-nav-overflow-trigger]",
    ) as HTMLElement;
    expect(trigger.hasAttribute("inert")).toBe(true);
    expect(trigger.className).toContain("invisible");
  });

  it("counts a child it does not know, and never folds it", async () => {
    render(
      <TabNav aria-label="Sections">
        <TabNavLink href="/list" current>
          List
        </TabNavLink>
        <span>Beta</span>
        <TabNavLink href="/board">Board</TabNavLink>
      </TabNav>,
    );
    await settle();
    expect(nav().style.getPropertyValue("--tab-nav-full")).toBe("91px");
    // List, Beta and the ⋯.
    expect(nav().style.getPropertyValue("--tab-nav-least")).toBe("72px");
    await layout.resize(80);
    expect(folded("Board")).toBe(true);
    expect(screen.getByText("Beta").hasAttribute("data-overflowed")).toBe(
      false,
    );
  });
});
