import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type AttachmentItem,
  AttachmentList,
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
    const stamp = row.querySelector("span[title]") as HTMLSpanElement;
    expect(stamp.getAttribute("title")).toBe("2026-09-01T00:01:00Z");
    expect(stamp.textContent).toBe(
      new Date("2026-09-01T00:01:00Z").toLocaleString(),
    );
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
    const download = row.querySelector("a[download]");
    expect(download?.getAttribute("download")).toBe("demo.html");
    expect(download?.getAttribute("aria-label")).toBe("download demo.html");
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
    expect(time?.getAttribute("dateTime")).toBe("2026-09-01T00:01:00Z");
  });
});
