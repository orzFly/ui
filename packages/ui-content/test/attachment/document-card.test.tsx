import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentCard } from "../../src/attachment/index.ts";

describe("DocumentCard", () => {
  it("draws header actions before download and expand", () => {
    const { container } = render(
      <DocumentCard
        name="spec.md"
        meta="1.5 KB"
        headerActions={<button type="button">v3</button>}
        downloadUrl="https://app.example/files/spec.md"
        onExpand={() => {}}
      >
        body
      </DocumentCard>,
    );
    const header = container.querySelector("section > div") as HTMLElement;
    const labels = [...header.querySelectorAll(":scope > button, :scope > a")]
      .map((el) => el.getAttribute("aria-label") ?? el.textContent)
      .slice(1);
    expect(labels).toEqual(["v3", "download spec.md", "expand spec.md"]);
    expect(screen.getByText("1.5 KB")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("draws download and expand as icon buttons, download still a link", () => {
    render(
      <DocumentCard
        name="spec.md"
        downloadUrl="https://app.example/files/spec.md"
        onExpand={() => {}}
      >
        body
      </DocumentCard>,
    );
    const download = screen.getByLabelText("download spec.md");
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe(
      "https://app.example/files/spec.md",
    );
    const expand = screen.getByLabelText("expand spec.md");
    expect(expand.tagName).toBe("BUTTON");
    for (const control of [download, expand]) {
      expect(control.dataset.slot).toBe("button");
      expect(control.dataset.size).toBe("icon-sm");
      // An icon button's hit area and the room it keeps beside it on touch.
      expect(control.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["touch:hit-area", "mx-(--hit-room)"]),
      );
    }
  });

  it("calls onExpand from the name and the expand button", () => {
    const onExpand = vi.fn();
    render(
      <DocumentCard name="spec.md" onExpand={onExpand}>
        body
      </DocumentCard>,
    );
    fireEvent.click(screen.getByLabelText("expand spec.md"));
    fireEvent.click(screen.getByText("spec.md"));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it("draws no expand controls without onExpand", () => {
    render(<DocumentCard name="spec.md">body</DocumentCard>);
    expect(screen.queryByLabelText("expand spec.md")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("puts className on the frame", () => {
    const { container } = render(
      <DocumentCard name="spec.md" className="marked">
        body
      </DocumentCard>,
    );
    expect(container.firstElementChild?.classList.contains("marked")).toBe(
      true,
    );
  });
});
