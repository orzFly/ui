import { undo } from "@codemirror/commands";
import { hasUnsavedWork } from "@orz/ui/lib/unsaved-guard";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { STAGED_FILE_TYPE } from "../src/extensions/staged-tokens.ts";
import {
  type StagedFiles,
  useStagedFiles,
} from "../src/hooks/use-staged-files.ts";
import {
  dropFiles,
  type MountedStaging,
  mountStaging,
  pasteFiles,
} from "./staging.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

const image = (name: string) =>
  new File(["bytes"], name, { type: "image/png" });

/** Put the caret (or a selection) where the reader would. */
function select(mounted: MountedStaging, anchor: number, head = anchor) {
  act(() => {
    mounted.cm().dispatch({ selection: { anchor, head } });
  });
}

async function send(mounted: MountedStaging): Promise<string> {
  let sent = "";
  await act(async () => {
    sent = await mounted.hook().resolve(mounted.text());
  });
  return sent;
}

describe("staging a file names it once", () => {
  it("renames the clipboard default on paste", () => {
    const mounted = mountStaging();
    pasteFiles(mounted, image("image.png"));
    expect(mounted.text()).toMatch(
      /^ !\[image-\d{8}-\d{6}-[0-9a-f]{4}\.png\]\(staged:\d+-[a-z0-9]{4}\) $/,
    );
  });

  it("leaves the same file alone when it is dropped or picked", () => {
    const dropped = mountStaging();
    dropFiles(dropped, image("image.png"));
    expect(dropped.text()).toMatch(
      /^ !\[image\.png\]\(staged:\d+-[a-z0-9]{4}\) $/,
    );
    const picked = mountStaging();
    act(() => {
      picked.hook().stage([image("image.png")]);
    });
    expect(picked.text()).toMatch(
      /^ !\[image\.png\]\(staged:\d+-[a-z0-9]{4}\) $/,
    );
  });

  it("links the name the upload settled on, not the local one", async () => {
    const mounted = mountStaging({
      upload: () =>
        Promise.resolve({
          url: "https://files.example/813",
          filename: "shot-813.txt",
        }),
    });
    act(() => {
      mounted
        .hook()
        .stage([new File(["bytes"], "shot.txt", { type: "text/plain" })]);
    });
    expect(await send(mounted)).toBe(
      "[shot-813.txt](https://files.example/813)",
    );
  });
});

describe("a staged file goes where the reader put it", () => {
  it("pastes its token at the caret and lists it", () => {
    const mounted = mountStaging({ initialValue: "before after" });
    select(mounted, 6);
    const event = pasteFiles(mounted, image("shot.png"));
    expect(event.defaultPrevented).toBe(true);
    expect(mounted.text()).toMatch(
      /^before !\[shot\.png\]\(staged:\d+-[a-z0-9]{4}\) {2}after$/,
    );
    expect(mounted.hook().staged.map((item) => item.file.name)).toEqual([
      "shot.png",
    ]);
  });

  it("replaces the selected text", () => {
    const mounted = mountStaging({ initialValue: "see HERE now" });
    select(mounted, 4, 8);
    pasteFiles(mounted, image("shot.png"));
    expect(mounted.text()).toMatch(
      /^see {2}!\[shot\.png\]\(staged:\d+-[a-z0-9]{4}\) {2}now$/,
    );
  });

  it("takes a dropped file without CodeMirror reading it in as text", async () => {
    const mounted = mountStaging();
    const event = dropFiles(
      mounted,
      new File(["file body"], "notes.txt", { type: "text/plain" }),
    );
    expect(event.defaultPrevented).toBe(true);
    expect(mounted.text()).toMatch(
      /^ \[notes\.txt\]\(staged:\d+-[a-z0-9]{4}\) $/,
    );
    // CodeMirror's own drop reads a file through FileReader, asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mounted.text()).not.toContain("file body");
  });

  it("attaches at the caret once the reader has pressed in the editor", () => {
    const mounted = mountStaging({ initialValue: "one two" });
    fireEvent.pointerDown(mounted.cm().contentDOM);
    select(mounted, 3);
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    expect(mounted.text()).toMatch(
      /^one !\[shot\.png\]\(staged:\d+-[a-z0-9]{4}\) {2}two$/,
    );
  });

  it("attaches at the end when the reader never put the caret anywhere", () => {
    // Where autoFocus leaves it, say. Not autoFocus itself: happy-dom fires
    // selectionchange inside a focused view's update, which CodeMirror
    // refuses.
    const mounted = mountStaging({ initialValue: "one two" });
    select(mounted, 3);
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    expect(mounted.text()).toMatch(
      /^one two !\[shot\.png\]\(staged:\d+-[a-z0-9]{4}\) $/,
    );
  });

  it("goes past code rather than inside it", () => {
    const mounted = mountStaging({ initialValue: "see `code` here" });
    fireEvent.pointerDown(mounted.cm().contentDOM);
    select(mounted, "see `co".length);
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    const token = mounted.hook().staged[0]?.token ?? "";
    expect(mounted.text()).toBe(`see \`code\` ${token}  here`);
  });
});

describe("the text is the record of what is staged", () => {
  it("counts each editor's files from 1, under keys of their own", () => {
    const one = mountStaging();
    const two = mountStaging();
    act(() => {
      one.hook().stage([image("a.png"), image("b.png")]);
      two.hook().stage([image("c.png")]);
    });
    const keys = (mounted: MountedStaging) =>
      mounted.hook().staged.map((item) => item.key);
    expect(keys(one).map((key) => key.split("-")[0])).toEqual(["1", "2"]);
    expect(keys(two).map((key) => key.split("-")[0])).toEqual(["1"]);
    expect(keys(two)[0]).not.toBe(keys(one)[0]);
  });

  it("counts on past what the editor still holds when its text is sent", () => {
    const mounted = mountStaging({ initialValue: "![x](staged:1-zzzz)" });
    act(() => {
      mounted.hook().clear();
    });
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    expect(mounted.hook().staged[0]?.key).toMatch(/^2-/);
  });

  it("does not count on from a number nobody could have counted to", () => {
    const mounted = mountStaging({
      initialValue: "![x](staged:1000000000000000000000-zzzz)",
    });
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    expect(mounted.hook().staged[0]?.key).toMatch(/^1-[a-z0-9]{4}$/);
  });

  it("never gives two editors on the page the same key", () => {
    const one = mountStaging();
    const two = mountStaging();
    // Every draw gives the same tag, so the second editor's first one is
    // the first editor's.
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    act(() => {
      one.hook().stage([image("a.png")]);
      two.hook().stage([image("b.png")]);
    });
    expect(two.hook().staged[0]?.key).not.toBe(one.hook().staged[0]?.key);
  });

  it("drops a file whose token was deleted, and undo brings both back", () => {
    const mounted = mountStaging();
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    const token = mounted.text();
    act(() => {
      mounted.cm().dispatch({
        changes: { from: 0, to: token.length },
        userEvent: "delete",
      });
    });
    expect(mounted.hook().staged).toEqual([]);
    act(() => {
      undo(mounted.cm());
    });
    expect(mounted.text()).toBe(token);
    expect(mounted.hook().staged).toHaveLength(1);
  });

  it("takes the token out of the text when the file is removed", () => {
    const mounted = mountStaging({ initialValue: "a b" });
    select(mounted, 1);
    pasteFiles(mounted, image("shot.png"));
    fireEvent.click(screen.getByRole("button", { name: "remove shot.png" }));
    expect(mounted.text()).toBe("a b");
    expect(mounted.hook().staged).toEqual([]);
  });

  it("counts as unsaved work while a file is staged", () => {
    const mounted = mountStaging();
    expect(hasUnsavedWork()).toBe(false);
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    expect(hasUnsavedWork()).toBe(true);
  });
});

describe("sending", () => {
  it("uploads only the files the text places, each where its token was", async () => {
    const mounted = mountStaging({ initialValue: "x y" });
    act(() => {
      mounted.hook().stage([image("gone.png")]);
    });
    act(() => {
      mounted
        .cm()
        .dispatch({ changes: { from: 0, to: mounted.text().length } });
    });
    act(() => {
      mounted.cm().dispatch({ changes: { from: 0, insert: "x y" } });
    });
    select(mounted, 1);
    pasteFiles(mounted, image("kept.png"));
    const sent = await send(mounted);
    expect(mounted.upload).toHaveBeenCalledOnce();
    expect(mounted.upload.mock.calls[0]?.[0].name).toBe("kept.png");
    // The caret's spaces go: one stays between the words.
    expect(sent).toBe("x ![kept.png](https://files.example/kept.png) y");
  });

  it("leaves a staged: link it does not know as text", async () => {
    const mounted = mountStaging({ initialValue: "![x](staged:1-zzzz)" });
    expect(await send(mounted)).toBe("![x](staged:1-zzzz)");
    expect(mounted.upload).not.toHaveBeenCalled();
  });

  it("names the file that failed, and uploads only the rest on a retry", async () => {
    let fail = true;
    const mounted = mountStaging({
      upload: (file) =>
        file.name === "b.png" && fail
          ? Promise.reject(new Error("too large"))
          : Promise.resolve({ url: `https://files.example/${file.name}` }),
    });
    act(() => {
      mounted.hook().stage([image("a.png"), image("b.png")]);
    });
    await expect(mounted.hook().resolve(mounted.text())).rejects.toThrow(
      "b.png: too large",
    );
    fail = false;
    const sent = await send(mounted);
    expect(mounted.upload.mock.calls.map(([file]) => file.name)).toEqual([
      "a.png",
      "b.png",
      "b.png",
    ]);
    expect(sent).toContain("](https://files.example/a.png)");
    expect(sent).toContain("](https://files.example/b.png)");
    expect(mounted.hook().pending(mounted.text())).toBe(true);
  });

  it("withdraws an upload whose token was deleted before the next send", async () => {
    const mounted = mountStaging({
      upload: (file) =>
        file.name === "b.png"
          ? Promise.reject(new Error("no"))
          : Promise.resolve({ url: `https://files.example/${file.name}` }),
    });
    act(() => {
      mounted.hook().stage([image("a.png"), image("b.png")]);
    });
    await expect(mounted.hook().resolve(mounted.text())).rejects.toThrow();
    act(() => {
      mounted
        .cm()
        .dispatch({ changes: { from: 0, to: mounted.text().length } });
    });
    await send(mounted);
    expect(mounted.withdraw).toHaveBeenCalledWith(
      { url: "https://files.example/a.png" },
      expect.objectContaining({ name: "a.png" }),
    );
  });

  it("uploads a file placed twice once, and points both spots at it", async () => {
    const mounted = mountStaging();
    pasteFiles(mounted, image("shot.png"));
    const token = mounted.text().trim();
    act(() => {
      mounted.cm().dispatch({
        changes: { from: token.length + 2, insert: `\n\nagain ${token} ` },
      });
    });
    expect(mounted.hook().staged).toHaveLength(1);
    const sent = await send(mounted);
    const marker = "![shot.png](https://files.example/shot.png)";
    expect(mounted.upload).toHaveBeenCalledOnce();
    expect(sent).toBe(`${marker}\n\nagain ${marker}`);
  });

  it("withdraws what was uploaded when the text is discarded", async () => {
    const mounted = mountStaging({
      upload: (file) =>
        file.name === "b.png"
          ? Promise.reject(new Error("no"))
          : Promise.resolve({ url: `https://files.example/${file.name}` }),
    });
    act(() => {
      mounted.hook().stage([image("a.png"), image("b.png")]);
    });
    await expect(mounted.hook().resolve(mounted.text())).rejects.toThrow();
    act(() => mounted.hook().discard());
    expect(mounted.withdraw).toHaveBeenCalledOnce();
    expect(mounted.hook().staged).toEqual([]);
  });
});

describe("an editor that is gone", () => {
  it("has no files placed in it any more", () => {
    let latest: StagedFiles | null = null;
    const upload = () => Promise.resolve({ url: "https://files.example/x" });
    function Harness({ editing }: { editing: boolean }) {
      const staging = useStagedFiles({ upload });
      latest = staging;
      return editing ? <MarkdownEditor staging={staging.editor} /> : null;
    }
    const view = render(<Harness editing />);
    view.rerender(<Harness editing={false} />);
    const hook = () => latest as StagedFiles;
    let placed = true;
    act(() => {
      placed = hook().stage([image("shot.png")]);
    });
    expect(placed).toBe(false);
    expect(hook().staged).toEqual([]);
  });
});

describe("dragging a staged file", () => {
  it("ignores one dragged in from another tab", () => {
    const mounted = mountStaging({ initialValue: "text" });
    const event = stagedDrop({
      [STAGED_FILE_TYPE]: JSON.stringify({ page: "another-tab", key: "1-z" }),
    });
    act(() => {
      mounted.cm().contentDOM.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(mounted.text()).toBe("text");
  });

  it("places its own file once more where it is dropped", () => {
    const mounted = mountStaging();
    pasteFiles(mounted, image("shot.png"));
    const token = mounted.text();
    const data = dragOut(mounted.root, "shot.png");
    act(() => {
      mounted.cm().contentDOM.dispatchEvent(stagedDrop(data));
    });
    // happy-dom's drop point is 0: in front of the first, with spaces of
    // its own like any file placed.
    expect(mounted.text()).toBe(`${token}${token}`);
    expect(mounted.hook().staged).toHaveLength(1);
  });

  it("takes over a file dragged in from another editor on the page", () => {
    const from = mountStaging();
    const to = mountStaging();
    const file = image("shot.png");
    act(() => {
      from.hook().stage([file]);
    });
    const data = dragOut(from.root, "shot.png");
    act(() => {
      to.cm().contentDOM.dispatchEvent(stagedDrop(data));
    });
    expect(to.hook().staged.map((item) => item.file)).toEqual([file]);
    expect(to.hook().staged[0]?.key).not.toBe(from.hook().staged[0]?.key);
    expect(to.text()).toBe(` ${to.hook().staged[0]?.token} `);
  });

  it("carries its page and key under its own type, with no text", () => {
    const mounted = mountStaging();
    pasteFiles(mounted, image("shot.png"));
    const data = dragOut(mounted.root, "shot.png");
    expect(Object.keys(data)).toEqual([STAGED_FILE_TYPE]);
    expect(JSON.parse(data[STAGED_FILE_TYPE] ?? "")).toEqual({
      page: expect.any(String),
      key: mounted.hook().staged[0]?.key,
    });
  });

  it("is refused by an editor that stages no files", () => {
    const view = render(<MarkdownEditor initialValue="text" />);
    const event = stagedDrop({
      [STAGED_FILE_TYPE]: JSON.stringify({ page: "x", key: "1-z" }),
    });
    const content = view.container.querySelector(".cm-content");
    act(() => {
      content?.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("staging in the plain editor", () => {
  const box = (root: ParentNode) =>
    root.querySelector<HTMLTextAreaElement>("textarea") as HTMLTextAreaElement;

  it("places a picked file at the end, and remove takes it back out", () => {
    const mounted = mountStaging({ plain: true, initialValue: "note" });
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    const el = box(mounted.root);
    expect(el.value).toMatch(/^note !\[shot\.png\]\(staged:1-\w+\) $/);
    fireEvent.click(screen.getByRole("button", { name: "remove shot.png" }));
    expect(el.value).toBe("note");
    expect(mounted.hook().staged).toEqual([]);
  });

  it("pastes a file at the caret once the reader has pressed in the box", () => {
    const mounted = mountStaging({ plain: true, initialValue: "a b" });
    const el = box(mounted.root);
    fireEvent.pointerDown(el);
    el.setSelectionRange(1, 1);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        types: ["Files"],
        files: [image("shot.png")],
        getData: () => "",
      },
    });
    act(() => {
      el.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(el.value).toMatch(/^a !\[shot\.png\]\(staged:1-\w+\) {2}b$/);
  });

  it("forgets a file whose token the reader deleted", () => {
    const mounted = mountStaging({ plain: true });
    act(() => {
      mounted.hook().stage([image("shot.png")]);
    });
    const el = box(mounted.root);
    el.value = "";
    fireEvent.input(el);
    expect(mounted.hook().staged).toEqual([]);
  });
});

/** What dragging the staged file `name` out of the harness's list carries. */
function dragOut(root: ParentNode, name: string): Record<string, string> {
  const data: Record<string, string> = {};
  const event = new Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      setData: (type: string, value: string) => {
        data[type] = value;
      },
      effectAllowed: "all",
    },
  });
  act(() => {
    root.querySelector(`[data-drag="${name}"]`)?.dispatchEvent(event);
  });
  return data;
}

/** A drop carrying `data` and no files. */
function stagedDrop(data: Record<string, string>): Event {
  const event = new MouseEvent("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      types: Object.keys(data),
      files: [],
      getData: (type: string) => data[type] ?? "",
    },
  });
  return event;
}
