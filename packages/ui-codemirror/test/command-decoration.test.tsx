import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { commandDecoration } from "../src/extensions/slash-commands.ts";
import {
  type CommandRegistry,
  createCommandRegistry,
} from "../src/lib/slash-commands.ts";
import { cmView } from "./cm.ts";

const registry = createCommandRegistry([
  {
    name: "close",
    argument: "none",
    detail: "→ Done",
    summarize: () => "close",
    compile: () => "close",
  },
  {
    name: "label",
    argument: "required",
    detail: "add a label",
    candidates: ["bug"],
    summarize: (argument) => `label ${argument}`,
    compile: (argument) => (argument === "bug" ? "label bug" : null),
  },
]);

const DOC = "/close\n/label nope\n```\n/close\n```\nprose";

/** The class list of each document line, in order. */
function lineClasses(root: ParentNode): string[] {
  const view = cmView(root);
  return Array.from({ length: view.state.doc.lines }, (_, i) => {
    const { from } = view.state.doc.line(i + 1);
    const { node } = view.domAtPos(from);
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest(".cm-line")?.className ?? "";
  });
}

describe("commandDecoration", () => {
  it("marks recognized lines, flags broken ones and skips fenced ones", () => {
    const view = render(
      <MarkdownEditor
        initialValue={DOC}
        extensions={commandDecoration(() => registry)}
      />,
    );
    const classes = lineClasses(view.container);
    expect(classes[0]).toContain("cm-command-line");
    expect(classes[0]).not.toContain("cm-command-line-broken");
    expect(classes[1]).toContain("cm-command-line");
    expect(classes[1]).toContain("cm-command-line-broken");
    for (const fenced of classes.slice(2)) {
      expect(fenced).not.toContain("cm-command-line");
    }
  });

  it("redraws once the registry arrives, with no document change", () => {
    let current: CommandRegistry<string> | null = null;
    const view = render(
      <MarkdownEditor
        initialValue={DOC}
        extensions={commandDecoration(() => current)}
      />,
    );
    expect(lineClasses(view.container)[0]).not.toContain("cm-command-line");

    current = registry;
    cmView(view.container).dispatch({});
    expect(lineClasses(view.container)[0]).toContain("cm-command-line");
    expect(lineClasses(view.container)[1]).toContain("cm-command-line-broken");
  });
});
