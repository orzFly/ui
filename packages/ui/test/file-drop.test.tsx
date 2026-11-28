import { act, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FileDrop,
  type FileDropProps,
  FileDropTrigger,
} from "../src/components/file-drop.tsx";
import { FakeDataTransfer, fireDrag, firePaste } from "./fake-data-transfer.ts";

const png = (name = "a.png") => new File(["png"], name, { type: "image/png" });
const text = (name = "notes.txt") =>
  new File(["text"], name, { type: "text/plain" });

function carrying(...files: File[]) {
  const data = new FakeDataTransfer();
  for (const file of files) data.addFile(file);
  return data;
}

function Zone({
  label = "Avatar",
  children,
  ...props
}: Partial<FileDropProps> & { label?: string }) {
  return (
    <FileDrop aria-label={label} onFile={() => {}} {...props}>
      <span>Picture</span>
      <FileDropTrigger>Upload…</FileDropTrigger>
      {children}
    </FileDrop>
  );
}

const zone = (label = "Avatar") => screen.getByRole("group", { name: label });
const inputOf = (el: Element) =>
  el.querySelector<HTMLInputElement>(':scope > [data-slot="file-drop-input"]');
const input = () => inputOf(zone()) as HTMLInputElement;

/** Chooses `file` in the zone's hidden input; reads what its value was left at. */
function choose(el: HTMLInputElement, file: File) {
  let value = `C:\\fakepath\\${file.name}`;
  Object.defineProperty(el, "value", {
    configurable: true,
    get: () => value,
    set: (next: string) => {
      value = next;
    },
  });
  fireEvent.change(el, { target: { files: [file] } });
  return () => value;
}

/** The pointer resting on `el`, which happy-dom never reports through `:hover`. */
function hover(el: Element) {
  const matches = el.matches.bind(el);
  Object.defineProperty(el, "matches", {
    value: (selector: string) =>
      selector === ":hover" ? true : matches(selector),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FileDrop: choosing", () => {
  it("hands over the chosen file and clears the input for the next choice", () => {
    const onFile = vi.fn();
    render(<Zone onFile={onFile} />);
    const file = png();
    const value = choose(input(), file);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(value()).toBe("");
  });

  it("fires again for the same file chosen twice", () => {
    const onFile = vi.fn();
    render(<Zone onFile={onFile} />);
    const file = png();
    choose(input(), file);
    choose(input(), file);
    expect(onFile).toHaveBeenCalledTimes(2);
  });

  it("refuses a chosen file accept turns away", () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<Zone accept="image/*" onFile={onFile} onReject={onReject} />);
    const file = text();
    choose(input(), file);
    expect(onFile).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(file);
  });

  it("opens the chooser from the trigger", () => {
    render(<Zone />);
    const click = vi.spyOn(input(), "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Upload…" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("leaves the chooser shut when the trigger's onClick prevents it", () => {
    render(
      <FileDrop aria-label="Avatar" onFile={() => {}}>
        <FileDropTrigger onClick={(event) => event.preventDefault()}>
          Upload…
        </FileDropTrigger>
      </FileDrop>,
    );
    const click = vi.spyOn(input(), "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Upload…" }));
    expect(click).not.toHaveBeenCalled();
  });

  it("never submits the form it sits in", () => {
    render(
      <form>
        <Zone />
      </form>,
    );
    expect(
      screen.getByRole("button", { name: "Upload…" }).getAttribute("type"),
    ).toBe("button");
  });
});

describe("FileDrop: accept", () => {
  it.each([
    [".JSON", new File(["{}"], "a.json", { type: "application/json" }), true],
    ["image/*", png(), true],
    ["application/json", text(), false],
    ["application/json", new File(["{}"], "a.json"), false],
    ["application/json, .json", new File(["{}"], "a.json"), true],
    ["", text(), true],
  ])("%s takes %s: %s", (accept, file, taken) => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<Zone accept={accept} onFile={onFile} onReject={onReject} />);
    choose(input(), file);
    expect(onFile).toHaveBeenCalledTimes(taken ? 1 : 0);
    expect(onReject).toHaveBeenCalledTimes(taken ? 0 : 1);
  });

  it("gives the hidden input the same accept", () => {
    render(<Zone accept="image/png" />);
    expect(input().getAttribute("accept")).toBe("image/png");
  });
});

describe("FileDrop: dragging", () => {
  it("ignores a drag that carries no files", () => {
    render(<Zone />);
    const data = new FakeDataTransfer();
    data.setData("text/plain", "words");
    fireDrag("dragEnter", zone(), data);
    expect(fireDrag("dragOver", zone(), data)).toBe(true);
    expect(zone().hasAttribute("data-drag")).toBe(false);
  });

  it("is ready once a file enters the window, and over under the pointer", () => {
    render(<Zone />);
    const data = carrying(png());
    fireDrag("dragEnter", document.body, data);
    expect(zone().getAttribute("data-drag")).toBe("ready");
    fireDrag("dragEnter", zone(), data);
    fireDrag("dragLeave", document.body, data);
    expect(fireDrag("dragOver", zone(), data)).toBe(false);
    expect(data.dropEffect).toBe("copy");
    expect(zone().getAttribute("data-drag")).toBe("over");
    const highlight = zone().querySelector('[data-slot="file-drop-highlight"]');
    expect(highlight?.getAttribute("data-drag")).toBe("over");
  });

  it("stays over when the pointer moves onto a child", () => {
    render(<Zone />);
    const data = carrying(png());
    const child = screen.getByText("Picture");
    fireDrag("dragEnter", zone(), data);
    fireDrag("dragOver", zone(), data);
    fireDrag("dragEnter", child, data);
    fireDrag("dragLeave", zone(), data);
    fireDrag("dragOver", child, data);
    expect(zone().getAttribute("data-drag")).toBe("over");
  });

  it("draws nothing once the drag leaves the window", () => {
    render(<Zone />);
    const data = carrying(png());
    fireDrag("dragEnter", document.body, data);
    fireDrag("dragEnter", zone(), data);
    fireDrag("dragLeave", document.body, data);
    fireDrag("dragOver", zone(), data);
    fireDrag("dragLeave", zone(), data);
    expect(zone().hasAttribute("data-drag")).toBe(false);
  });

  it("shows the other zones as ready while one is over", () => {
    render(
      <>
        <Zone label="A" />
        <Zone label="B" />
      </>,
    );
    const data = carrying(png());
    fireDrag("dragEnter", zone("A"), data);
    fireDrag("dragOver", zone("A"), data);
    expect(zone("A").getAttribute("data-drag")).toBe("over");
    expect(zone("B").getAttribute("data-drag")).toBe("ready");
  });

  it("lets go of a drag that goes quiet, as one cancelled with Esc does", () => {
    vi.useFakeTimers();
    render(<Zone />);
    const data = carrying(png());
    fireDrag("dragEnter", zone(), data);
    fireDrag("dragOver", zone(), data);
    act(() => vi.advanceTimersByTime(900));
    fireDrag("dragOver", zone(), data);
    act(() => vi.advanceTimersByTime(900));
    expect(zone().getAttribute("data-drag")).toBe("over");
    act(() => vi.advanceTimersByTime(100));
    expect(zone().hasAttribute("data-drag")).toBe(false);
  });

  it("shows no ready under an aria-hidden ancestor, such as behind a modal", () => {
    render(
      <>
        <div aria-hidden="true">
          <FileDrop aria-label="Hidden" onFile={() => {}} />
        </div>
        <Zone />
      </>,
    );
    const data = carrying(png());
    fireDrag("dragEnter", document.body, data);
    expect(zone().getAttribute("data-drag")).toBe("ready");
    const hidden = document.querySelector('[aria-label="Hidden"]');
    expect(hidden?.hasAttribute("data-drag")).toBe(false);
  });
});

describe("FileDrop: dropping", () => {
  it("takes the first file accept takes", () => {
    const onFile = vi.fn();
    render(<Zone accept="image/*" onFile={onFile} />);
    const wanted = png();
    const data = carrying(text(), wanted, png("b.png"));
    fireDrag("dragEnter", zone(), data);
    fireDrag("dragOver", zone(), data);
    expect(fireDrag("drop", zone(), data)).toBe(false);
    expect(onFile).toHaveBeenCalledExactlyOnceWith(wanted);
    expect(zone().hasAttribute("data-drag")).toBe(false);
  });

  it("refuses the first file when accept takes none", () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<Zone accept="image/*" onFile={onFile} onReject={onReject} />);
    const first = text();
    fireDrag("drop", zone(), carrying(first, text("b.txt")));
    expect(onFile).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("never takes a folder", () => {
    const onFile = vi.fn();
    render(<Zone onFile={onFile} />);
    const data = new FakeDataTransfer();
    data.addFile(new File([], "photos"), { directory: true });
    fireDrag("drop", zone(), data);
    expect(onFile).not.toHaveBeenCalled();
    const file = png();
    data.addFile(file);
    fireDrag("drop", zone(), data);
    expect(onFile).toHaveBeenCalledExactlyOnceWith(file);
  });

  it("takes a drop that no dragover came before", () => {
    const onFile = vi.fn();
    render(<Zone onFile={onFile} />);
    const file = png();
    fireDrag("drop", screen.getByText("Picture"), carrying(file));
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("gives a drop on a nested zone to the inner one alone", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Zone label="Outer" onFile={outer}>
        <Zone label="Inner" onFile={inner} />
      </Zone>,
    );
    const data = carrying(png());
    fireDrag("dragEnter", zone("Inner"), data);
    fireDrag("dragOver", zone("Inner"), data);
    expect(zone("Inner").getAttribute("data-drag")).toBe("over");
    expect(zone("Outer").getAttribute("data-drag")).toBe("ready");
    fireDrag("drop", zone("Inner"), data);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("lets no outer zone take what a disabled inner one does not", () => {
    const outer = vi.fn();
    render(
      <Zone label="Outer" onFile={outer}>
        <Zone label="Inner" disabled />
      </Zone>,
    );
    const data = carrying(png());
    expect(fireDrag("dragOver", zone("Inner"), data)).toBe(false);
    expect(data.dropEffect).toBe("none");
    expect(fireDrag("drop", zone("Inner"), data)).toBe(false);
    expect(outer).not.toHaveBeenCalled();
  });

  it("gives way to an editor inside that takes the file itself", () => {
    const onFile = vi.fn();
    const take = (event: React.DragEvent) => event.preventDefault();
    render(
      <Zone onFile={onFile}>
        <textarea aria-label="Editor" onDragOver={take} onDrop={take} />
      </Zone>,
    );
    const editor = screen.getByRole("textbox", { name: "Editor" });
    const data = carrying(png());
    fireDrag("dragEnter", editor, data);
    fireDrag("dragOver", editor, data);
    expect(zone().getAttribute("data-drag")).toBe("ready");
    fireDrag("drop", editor, data);
    expect(onFile).not.toHaveBeenCalled();
  });
});

describe("FileDrop: a drop outside every zone", () => {
  it("is caught rather than opened in place of the page", () => {
    render(
      <>
        <Zone />
        <p>Elsewhere</p>
      </>,
    );
    const data = carrying(png());
    expect(fireDrag("dragOver", screen.getByText("Elsewhere"), data)).toBe(
      false,
    );
    expect(data.dropEffect).toBe("none");
    expect(fireDrag("drop", screen.getByText("Elsewhere"), data)).toBe(false);
  });

  it("is left to a text field", () => {
    render(
      <>
        <Zone />
        <textarea aria-label="Notes" />
      </>,
    );
    const notes = screen.getByRole("textbox", { name: "Notes" });
    expect(fireDrag("dragOver", notes, carrying(png()))).toBe(true);
    expect(fireDrag("drop", notes, carrying(png()))).toBe(true);
  });

  it("is left alone once no zone is mounted", () => {
    const { unmount } = render(<Zone />);
    unmount();
    expect(fireDrag("dragOver", document.body, carrying(png()))).toBe(true);
    expect(fireDrag("drop", document.body, carrying(png()))).toBe(true);
  });
});

describe("FileDrop: pasting", () => {
  it("takes a file pasted with the focus inside, and refuses one accept turns away", () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<Zone accept="image/*" onFile={onFile} onReject={onReject} />);
    const button = screen.getByRole("button", { name: "Upload…" });
    button.focus();
    const file = png();
    expect(firePaste(button, carrying(file))).toBe(false);
    expect(onFile).toHaveBeenCalledWith(file);
    const refused = text();
    expect(firePaste(button, carrying(refused))).toBe(false);
    expect(onReject).toHaveBeenCalledWith(refused);
  });

  it("takes a file pasted with the pointer on it, and leaves one accept turns away", () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<Zone accept="image/*" onFile={onFile} onReject={onReject} />);
    hover(zone());
    const file = png();
    expect(firePaste(document.body, carrying(file))).toBe(false);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(firePaste(document.body, carrying(text()))).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("never stops a paste of text alone", () => {
    render(<Zone />);
    const button = screen.getByRole("button", { name: "Upload…" });
    button.focus();
    const data = new FakeDataTransfer();
    data.setData("text/plain", "words");
    expect(firePaste(button, data)).toBe(true);
  });

  it("leaves a paste something inside has taken", () => {
    const onFile = vi.fn();
    render(
      <Zone onFile={onFile}>
        <textarea
          aria-label="Theme file"
          onPaste={(event) => event.preventDefault()}
        />
      </Zone>,
    );
    const field = screen.getByRole("textbox", { name: "Theme file" });
    field.focus();
    firePaste(field, carrying(png()));
    expect(onFile).not.toHaveBeenCalled();
  });

  it("leaves text with a file to a field outside that has the focus", () => {
    const onFile = vi.fn();
    render(
      <>
        <Zone onFile={onFile} />
        <input aria-label="Name" />
      </>,
    );
    hover(zone());
    const name = screen.getByRole("textbox", { name: "Name" });
    name.focus();
    const data = carrying(png());
    data.setData("text/plain", "words");
    expect(firePaste(name, data)).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("lets text with a refused picture into a field inside, and takes a wanted file", () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(
      <Zone accept=".json" onFile={onFile} onReject={onReject}>
        <textarea aria-label="Theme file" />
      </Zone>,
    );
    const field = screen.getByRole("textbox", { name: "Theme file" });
    field.focus();
    const picture = carrying(png());
    picture.setData("text/plain", "a cell");
    expect(firePaste(field, picture)).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
    const file = new File(["{}"], "themes.json");
    const wanted = carrying(file);
    wanted.setData("text/plain", "themes.json");
    expect(firePaste(field, wanted)).toBe(false);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("leaves a paste with neither focus nor pointer on a zone", () => {
    const onFile = vi.fn();
    render(<Zone onFile={onFile} />);
    expect(firePaste(document.body, carrying(png()))).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });
});

describe("FileDrop: disabled", () => {
  it("takes nothing and draws nothing", () => {
    const onFile = vi.fn();
    render(<Zone disabled onFile={onFile} />);
    expect(
      (screen.getByRole("button", { name: "Upload…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(zone().hasAttribute("data-disabled")).toBe(true);
    const data = carrying(png());
    fireDrag("dragEnter", zone(), data);
    expect(fireDrag("dragOver", zone(), data)).toBe(false);
    expect(data.dropEffect).toBe("none");
    expect(zone().hasAttribute("data-drag")).toBe(false);
    hover(zone());
    expect(firePaste(document.body, carrying(png()))).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });
});

describe("FileDrop: asChild", () => {
  it("puts the zone on the child, which keeps its own role", () => {
    render(
      <FileDrop asChild purpose="pane" onFile={() => {}} className="h-full">
        <main className="flex">
          <FileDropTrigger>Open file…</FileDropTrigger>
        </main>
      </FileDrop>,
    );
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-slot")).toBe("file-drop");
    expect(main.getAttribute("data-purpose")).toBe("pane");
    expect(main.hasAttribute("role")).toBe(false);
    expect(main.className).toContain("relative isolate");
    expect(main.className).toContain("h-full");
    expect(main.className).toContain("flex");
    expect(inputOf(main)).not.toBeNull();
    expect(
      main.querySelector(':scope > [data-slot="file-drop-highlight"]'),
    ).not.toBeNull();
  });
});

describe("FileDropTrigger", () => {
  it("puts the chooser on the caller's button, which keeps its own look", () => {
    render(
      <FileDrop aria-label="Attachments" disabled onFile={() => {}}>
        <FileDropTrigger asChild>
          <button type="button" className="mine">
            Attach…
          </button>
        </FileDropTrigger>
      </FileDrop>,
    );
    const button = screen.getByRole("button", {
      name: "Attach…",
    }) as HTMLButtonElement;
    expect(button.className).toBe("mine");
    expect(button.disabled).toBe(true);
  });

  it("opens the chooser from the caller's button", () => {
    render(
      <FileDrop aria-label="Attachments" onFile={() => {}}>
        <FileDropTrigger asChild>
          <button type="button">Attach…</button>
        </FileDropTrigger>
      </FileDrop>,
    );
    const click = vi
      .spyOn(inputOf(zone("Attachments")) as HTMLInputElement, "click")
      .mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Attach…" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("throws outside a FileDrop", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<FileDropTrigger>Upload…</FileDropTrigger>)).toThrow(
      "FileDropTrigger renders inside a FileDrop",
    );
  });
});
