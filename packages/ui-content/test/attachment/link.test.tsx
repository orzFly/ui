import { RICH_CHIP_SKIN } from "@orz/ui/components/link-chip";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AttachmentLink,
  AttachmentViewerProvider,
  type FileSource,
} from "../../src/attachment/index.ts";
import { ContentRenderers } from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

const RENDERERS = [stubText];

function renderLink(target: FileSource, boxed?: boolean) {
  render(
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider
        viewHref={(f) => `https://app.example/view/${f.name}`}
      >
        <AttachmentLink file={target} boxed={boxed} />
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
  return screen.getByRole("link");
}

const NOTES = file("notes.txt", { size: 10 });

describe("AttachmentLink", () => {
  it("is an anchor to viewHref, labelled and titled with the name", () => {
    const link = renderLink(NOTES);
    expect(link.getAttribute("href")).toBe(
      "https://app.example/view/notes.txt",
    );
    expect(link.getAttribute("title")).toBe("notes.txt");
    expect(link.textContent).toBe("notes.txt");
  });

  it("points at url outside a provider", () => {
    render(<AttachmentLink file={NOTES}>the notes</AttachmentLink>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://app.example/files/notes.txt",
    );
    expect(link.textContent).toBe("the notes");
    // Nothing to open: a plain click stays the browser's.
    expect(fireEvent.click(link)).toBe(true);
  });

  it("opens the viewer on a plain click", () => {
    const link = renderLink(NOTES);
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("stub").textContent).toBe("stub:notes.txt");
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "leaves a %s click to the browser",
    (modifier) => {
      const link = renderLink(NOTES);
      expect(fireEvent.click(link, { [modifier]: true })).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("never hijacks a click on a file the viewer cannot draw", () => {
    const link = renderLink(file("bundle.zip", { size: 10 }));
    expect(fireEvent.click(link)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("draws no href for a file with nowhere to point", () => {
    render(<AttachmentLink file={{ kind: "file", name: "gone.txt" }} />);
    const anchor = screen.getByText("gone.txt").closest("a");
    expect(anchor?.hasAttribute("href")).toBe(false);
  });

  it("wears the skin only when boxed", () => {
    const skin = RICH_CHIP_SKIN.split(" ")[0] as string;
    expect(renderLink(NOTES, true).classList.contains(skin)).toBe(true);
  });

  it("underlines on hover when not boxed", () => {
    const link = renderLink(NOTES, false);
    expect(link.classList.contains("hover:underline")).toBe(true);
    expect(link.classList.contains("border")).toBe(false);
  });

  it("wears the file's type icon", () => {
    const link = renderLink(file("bundle.zip"));
    expect(
      link.querySelector("svg")?.classList.contains("lucide-file-archive"),
    ).toBe(true);
  });
});
