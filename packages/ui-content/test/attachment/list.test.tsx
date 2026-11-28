import { formatTimestamp } from "@orz/ui/components/timestamp";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AttachmentItem,
  AttachmentList,
  type AttachmentListProps,
  AttachmentViewerProvider,
  type AttachmentViewerProviderProps,
  imageContent,
} from "../../src/attachment/index.ts";
import { ContentRenderers } from "../../src/index.ts";

/**
 * The folded list: a long list shows its newest five and hides the head
 * behind one toggle. The list itself stays ascending — the fold moves, not
 * the order — so the numbers below are about which end of the array survives.
 */

const RENDERERS = [imageContent()];

const shot = (n: number): AttachmentItem => ({
  kind: "file",
  key: n,
  name: `shot-${n}.png`,
  mime: "image/png",
  size: 512,
  url: `https://app.example/files/${n}/shot-${n}.png`,
  // Ascending, one minute apart.
  createdAt: `2026-09-01T00:0${n}:00Z`,
});

const shots = (count: number) =>
  Array.from({ length: count }, (_, i) => shot(i + 1));

function draw(
  items: AttachmentItem[],
  props: Omit<AttachmentViewerProviderProps, "children"> = {},
) {
  return render(
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider {...props}>
        <AttachmentList items={items} id="attachments" />
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
}

const names = (container: HTMLElement) =>
  [...container.querySelectorAll("li")].map(
    (li) => li.querySelector("span")?.textContent,
  );

describe("the attachment list folds a long list", () => {
  it("keeps the newest five and hides the head behind a toggle", () => {
    const { container } = draw(shots(8));
    expect(container.querySelectorAll("li")).toHaveLength(5);
    // The tail, in the list's own order — not the head, and not reversed.
    expect(names(container)).toEqual([
      "shot-4.png",
      "shot-5.png",
      "shot-6.png",
      "shot-7.png",
      "shot-8.png",
    ]);

    // Above the list, where it reads as a continuation of the header rather
    // than as a ninth row.
    const toggle = screen.getByTestId("attachment-fold-toggle");
    const list = container.querySelector("ul") as HTMLUListElement;
    expect(
      toggle.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toggle.textContent).toContain("Show 3 more");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands in place and folds back", () => {
    const { container } = draw(shots(8));
    const toggle = screen.getByTestId("attachment-fold-toggle");

    fireEvent.click(toggle);
    expect(container.querySelectorAll("li")).toHaveLength(8);
    expect(names(container)[0]).toBe("shot-1.png");
    expect(toggle.textContent).toContain("Show less");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(container.querySelectorAll("li")).toHaveLength(5);
    expect(toggle.textContent).toContain("Show 3 more");
  });

  it("leaves seven files alone — folding them would save nothing", () => {
    const { container } = draw(shots(7));
    expect(container.querySelectorAll("li")).toHaveLength(7);
    expect(screen.queryByTestId("attachment-fold-toggle")).toBeNull();
  });

  it("opens the viewer on the file that was clicked, not on its row number", () => {
    const { container } = draw(shots(8));
    // Folded, the first row is the list's fourth file. A viewer paging from
    // index 0 would open shot-1.png, which is not even on screen.
    fireEvent.click(container.querySelector("li a") as HTMLAnchorElement);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe("shot-4.png");
    expect(within(dialog).getByText("4 / 8")).toBeTruthy();
  });

  it("prints each file's upload time", () => {
    const { container } = draw(shots(3));
    const row = container.querySelector("li") as HTMLLIElement;
    const stamp = row.querySelector("time") as HTMLTimeElement;
    expect(stamp.getAttribute("datetime")).toBe("2026-09-01T00:01:00.000Z");
    expect(stamp.textContent).toBe(formatTimestamp("2026-09-01T00:01:00Z"));
    expect(stamp.getAttribute("title")).toMatch(/:01:00/);
  });

  it("renders nothing for an empty list", () => {
    const { container } = draw([]);
    expect(container.querySelector("section")).toBeNull();
  });

  it("carries the header, count and jump target", () => {
    const { container } = draw(shots(2));
    const section = container.querySelector("section");
    expect(section?.id).toBe("attachments");
    expect(section?.firstElementChild?.textContent).toBe("Attachments2");
  });
});

const hrefs = (root: Element) =>
  [...root.querySelectorAll("a")].map((a) => a.getAttribute("href"));

const ROWS: AttachmentItem[] = [
  {
    kind: "file",
    key: 1,
    name: "demo.html",
    mime: "text/html",
    size: 512,
    url: "https://app.example/files/1/demo.html",
  },
  {
    kind: "file",
    key: 2,
    name: "archive.zip",
    mime: "application/zip",
    size: 512,
    url: "https://app.example/files/2/archive.zip",
  },
];

/** An app with a separate inline-view URL for the types a tab renders. */
const viewHref: AttachmentViewerProviderProps["viewHref"] = (f) =>
  f.mime?.startsWith("text/") && f.url
    ? f.url.replace("/files/", "/view/")
    : undefined;

describe("attachment list rows", () => {
  it("points a viewable row at viewHref and keeps a download action beside it", () => {
    const { container } = draw(ROWS, { viewHref });
    const row = container.querySelector("li") as HTMLLIElement;
    expect(hrefs(row)).toEqual([
      "https://app.example/view/1/demo.html",
      "https://app.example/files/1/demo.html",
    ]);
    const download = row.querySelector("a[download]") as HTMLAnchorElement;
    expect(download.getAttribute("download")).toBe("demo.html");
    expect(download.getAttribute("aria-label")).toBe("download demo.html");
    // An icon button, with its hit area and its room on touch, that is still a link.
    expect(download.dataset.slot).toBe("button");
    expect(download.dataset.size).toBe("icon-sm");
    expect(download.className.split(/\s+/)).toContain("touch:hit-area");
  });

  it("points a row viewHref leaves out at url", () => {
    const { container } = draw(ROWS, { viewHref });
    const row = container.querySelectorAll("li")[1] as HTMLLIElement;
    expect(hrefs(row)).toEqual([
      "https://app.example/files/2/archive.zip",
      "https://app.example/files/2/archive.zip",
    ]);
  });

  it("leaves a click on a row the viewer cannot draw to the browser", () => {
    const { container } = draw(ROWS);
    const row = container.querySelectorAll("li")[1] as HTMLLIElement;
    expect(fireEvent.click(row.querySelector("a") as HTMLAnchorElement)).toBe(
      true,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the attachment list's row actions", () => {
  it("draws each row's actions after its download link", () => {
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <AttachmentViewerProvider>
          <AttachmentList
            items={shots(2)}
            actions={(item) => (
              <button type="button" aria-label={`delete ${item.name}`} />
            )}
          />
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );
    const rows = [...container.querySelectorAll("li")];
    expect(
      rows.map((li) => li.lastElementChild?.getAttribute("aria-label")),
    ).toEqual(["delete shot-1.png", "delete shot-2.png"]);
  });
});

describe("the attachment list's upload time", () => {
  it("is a <time> carrying the instant it prints", () => {
    const { container } = draw(shots(1));
    const time = container.querySelector("li time");
    expect(time?.getAttribute("dateTime")).toBe("2026-09-01T00:01:00.000Z");
  });
});

const patch = (n: number): AttachmentItem => ({
  kind: "file",
  key: `p${n}`,
  name: `000${n}-fix.patch`,
  mime: "application/octet-stream",
  size: 512,
  url: `https://app.example/files/p${n}/000${n}-fix.patch`,
});

function drawWith(
  items: AttachmentItem[],
  props: Omit<AttachmentListProps, "items">,
) {
  return render(
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <AttachmentList items={items} {...props} />
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
}

describe("an unfolded attachment list", () => {
  it("keeps every row and draws no toggle", () => {
    const { container } = drawWith(shots(10), { fold: false });
    expect(container.querySelectorAll("li")).toHaveLength(10);
    expect(screen.queryByTestId("attachment-fold-toggle")).toBeNull();
  });
});

describe("attachment thumbnails", () => {
  // A series in the order a message carries it: a screenshot between two
  // patches.
  const series = [patch(1), shot(1), patch(2)];

  it("draws images under the rows, not as rows", () => {
    const { container } = drawWith(series, { thumbnails: true });
    expect(names(container)).toEqual(["0001-fix.patch", "0002-fix.patch"]);
    const thumbnail = container.querySelector("img") as HTMLImageElement;
    expect(thumbnail.closest("li")).toBeNull();
    expect(thumbnail.getAttribute("src")).toBe(shot(1).url);
    expect(
      container.querySelector('a[download="shot-1.png"]')?.closest("li"),
    ).toBeNull();
  });

  it("opens the viewer at the image's place in the whole list", () => {
    const { container } = drawWith(series, { thumbnails: true });
    const thumbnail = container.querySelector("img") as HTMLImageElement;
    fireEvent.click(thumbnail.closest("a") as HTMLAnchorElement);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe("shot-1.png");
    expect(within(dialog).getByText("2 / 3")).toBeTruthy();
  });

  it("leaves images as rows when not asked", () => {
    const { container } = drawWith(series, {});
    expect(names(container)).toEqual([
      "0001-fix.patch",
      "shot-1.png",
      "0002-fix.patch",
    ]);
  });
});

describe("a selectable attachment list", () => {
  const box = (name: string) => screen.getByRole("checkbox", { name });
  const checked = (name: string) =>
    box(name).getAttribute("aria-checked") === "true";
  const status = () => screen.getByRole("status").textContent;

  it("draws no checkbox unless asked", () => {
    drawWith(shots(3), {});
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("puts each row's checkbox in its icon's place", () => {
    const { container } = drawWith(shots(3), { selectable: true });
    const slot = box("select shot-1.png").closest(
      "[data-slot=select-slot]",
    ) as HTMLElement;
    expect(slot.querySelector("[data-slot=select-slot-icon] svg")).toBeTruthy();
    // The row's link no longer leads with an icon of its own.
    const link = container.querySelector("li a") as HTMLAnchorElement;
    expect(link.querySelector(":scope > svg")).toBeNull();
    expect(slot.hasAttribute("data-revealed")).toBe(false);
    fireEvent.pointerEnter(slot.closest("li") as HTMLElement, {
      pointerType: "mouse",
    });
    expect(slot.hasAttribute("data-revealed")).toBe(true);
  });

  it("selects a row, then a range with Shift, and counts them in the header", () => {
    const { container } = drawWith(shots(4), { selectable: true });
    expect(status()).toBe("");
    fireEvent.click(box("select shot-1.png"));
    fireEvent.click(box("select shot-3.png"), { shiftKey: true });
    expect(status()).toBe("3 selected");
    expect(checked("select shot-2.png")).toBe(true);
    expect(checked("select shot-4.png")).toBe(false);
    const rows = [...container.querySelectorAll("li")];
    expect(rows.map((row) => row.hasAttribute("data-selected"))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(
      container.querySelector("section")?.hasAttribute("data-selecting"),
    ).toBe(true);
  });

  it("selects every file, folded ones too, from the header's box", () => {
    drawWith(shots(8), { selectable: true });
    fireEvent.click(box("Select all"));
    expect(status()).toBe("8 selected");
    fireEvent.click(box("Select all"));
    expect(status()).toBe("");
  });

  it("hands the selected files to the app's actions", () => {
    const seen: string[][] = [];
    drawWith(shots(3), {
      selectable: true,
      selectionActions: (items) => {
        seen.push(items.map((item) => item.name));
        return <button type="button">Delete {items.length}</button>;
      },
    });
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    fireEvent.click(box("select shot-2.png"));
    expect(screen.getByRole("button", { name: "Delete 1" })).toBeTruthy();
    expect(seen.at(-1)).toEqual(["shot-2.png"]);
  });

  it("follows the selection the app holds", () => {
    const changes: AttachmentItem["key"][][] = [];
    drawWith(shots(3), {
      selectable: true,
      selected: [2],
      onSelectedChange: (keys) => changes.push(keys),
    });
    expect(checked("select shot-2.png")).toBe(true);
    fireEvent.click(box("select shot-3.png"));
    expect(changes).toEqual([[2, 3]]);
  });

  it("selects every row a drag down the boxes crosses, under the item's own keys", () => {
    const changes: AttachmentItem["key"][][] = [];
    const { container } = drawWith(shots(4), {
      selectable: true,
      onSelectedChange: (keys) => changes.push(keys),
    });
    const rows = [...container.querySelectorAll("li")];
    // No layout here: the pointer's y picks the row, 30px each.
    const spy = vi
      .spyOn(document, "elementFromPoint")
      .mockImplementation((_x, y) => rows[Math.floor(y / 30)] ?? null);
    fireEvent.pointerDown(box("select shot-1.png"), {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 5,
      clientY: 15,
    });
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 5,
          clientY: 75,
        }),
      );
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    });
    spy.mockRestore();
    expect(changes.at(-1)).toEqual([1, 2, 3]);
    expect(status()).toBe("3 selected");
  });

  it("gives a thumbnail a checkbox of its own", () => {
    drawWith([shot(1), shot(2)], { selectable: true, thumbnails: true });
    fireEvent.click(box("select shot-2.png"));
    expect(status()).toBe("1 selected");
  });
});
