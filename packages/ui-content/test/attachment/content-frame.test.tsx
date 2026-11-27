import { render, screen } from "@testing-library/react";
import { FileIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ContentFrame, ContentHeader } from "../../src/attachment/index.ts";

const classes = (el: Element | null) => el?.className.split(/\s+/) ?? [];

const header = (container: HTMLElement) =>
  container.querySelector("[data-slot=content-header]") as HTMLElement;

describe("ContentFrame", () => {
  it("draws the edge, and a sunken well under raymond", () => {
    const { container } = render(
      <ContentFrame className="marked" data-testid="frame">
        body
      </ContentFrame>,
    );
    const frame = screen.getByTestId("frame");
    expect(frame).toBe(container.firstElementChild);
    expect(frame.dataset.slot).toBe("content-frame");
    expect(classes(frame)).toEqual(
      expect.arrayContaining([
        "ring-1",
        "overflow-hidden",
        "raymond:shadow-sunken",
        "raymond:[--background:var(--window)]",
        "marked",
      ]),
    );
  });

  it("takes a caller's data-slot", () => {
    const { container } = render(
      <ContentFrame data-slot="fence-frame">body</ContentFrame>,
    );
    expect(container.querySelector("[data-slot=fence-frame]")).not.toBeNull();
  });
});

describe("ContentHeader", () => {
  it("draws the icon in the module marker", () => {
    const { container } = render(
      <ContentHeader icon={<FileIcon data-testid="icon" />} name="a.ts" />,
    );
    const marker = header(container).querySelector("[data-slot=module-marker]");
    expect(marker?.contains(screen.getByTestId("icon"))).toBe(true);
  });

  it("draws a name in monospace in the text colour, truncated", () => {
    render(
      <ContentHeader icon={<FileIcon />} name="compose.yaml" lang="yaml" />,
    );
    const name = screen.getByText("compose.yaml");
    expect(classes(name)).toEqual(
      expect.arrayContaining([
        "font-mono",
        "text-foreground",
        "truncate",
        "min-w-0",
      ]),
    );
    // The name says what the language would.
    expect(screen.queryByText("yaml")).toBeNull();
  });

  it("draws the language in place of a name, muted", () => {
    render(<ContentHeader icon={<FileIcon />} lang="patch" />);
    const lang = screen.getByText("patch");
    expect(classes(lang)).toContain("font-mono");
    expect(classes(lang)).not.toContain("text-foreground");
  });

  it("draws meta after the name, untruncated", () => {
    render(<ContentHeader icon={<FileIcon />} name="a.md" meta="1.5 KB" />);
    const meta = screen.getByText("1.5 KB");
    expect(classes(meta)).toContain("shrink-0");
    expect(screen.getByText("a.md").nextElementSibling).toBe(meta);
  });

  it("puts its controls at the end", () => {
    render(
      <ContentHeader icon={<FileIcon />} name="a.md">
        <button type="button">Copy</button>
      </ContentHeader>,
    );
    const end = screen.getByRole("button", { name: "Copy" }).parentElement;
    expect(classes(end)).toEqual(expect.arrayContaining(["ml-auto"]));
  });

  it("is a row tall, a hit area tall on touch, and a band of the face under raymond", () => {
    const { container } = render(<ContentHeader icon={<FileIcon />} />);
    expect(classes(header(container))).toEqual(
      expect.arrayContaining([
        "min-h-row",
        "touch:min-h-touch",
        "bg-muted",
        "border-b",
        "raymond:bg-(--3d-face)",
        "raymond:border-b-0",
        "select-none",
      ]),
    );
  });
});
