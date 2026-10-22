import {
  type CommandRegistry,
  createCommandRegistry,
  type ValueProviders,
} from "@orz/query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { commandDecoration } from "../src/extensions/slash-commands.ts";
import { cmView } from "./cm.ts";

const registry = createCommandRegistry([
  {
    name: "close",
    detail: "→ Done",
    args: [],
    summarize: () => "close",
    compile: () => "close",
  },
  {
    name: "label",
    detail: "add a label",
    args: [
      { name: "label", value: { kind: "named", source: "label" }, rest: true },
    ],
    summarize: ([name]) => `label ${name}`,
    compile: ([name]) => (name === "bug" ? "label bug" : null),
  },
  {
    name: "assign",
    detail: "assign people",
    args: [
      {
        name: "login",
        value: { kind: "named", source: "member", special: ["@me"] },
        multiple: true,
      },
    ],
    summarize: () => "assign",
    compile: () => "assign",
  },
]);

const PROVIDERS: ValueProviders = {
  label: { options: [{ value: "bug" }] },
  member: { options: [{ value: "alice" }, { value: "bot-one" }] },
};

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

/** Each marked token's text and classes, in document order. */
function tokens(root: ParentNode): [string, string][] {
  return Array.from(
    root.querySelectorAll(".cm-command-name, .cm-command-arg"),
    (element) => [element.textContent ?? "", element.className],
  );
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

  it("marks the command name and each argument by its verdict", () => {
    const view = render(
      <MarkdownEditor
        initialValue={"/label bug\n/assign {alice,@me}\n/assign {alice,nobody}"}
        extensions={commandDecoration(
          () => registry,
          () => PROVIDERS,
        )}
      />,
    );
    expect(tokens(view.container)).toEqual([
      ["/label", "cm-command-name"],
      ["bug", "cm-command-arg"],
      ["/assign", "cm-command-name"],
      ["{alice,@me}", "cm-command-arg cm-command-arg-special"],
      ["/assign", "cm-command-name"],
      ["{alice,nobody}", "cm-command-arg cm-command-arg-invalid"],
    ]);
  });

  it("redraws on a new providers object, with no document change", () => {
    let providers: ValueProviders | null = null;
    const view = render(
      <MarkdownEditor
        initialValue="/label nope"
        extensions={commandDecoration(
          () => registry,
          () => providers,
        )}
      />,
    );
    // Without a provider nothing can tell, so only compile breaks the line.
    expect(tokens(view.container)).toEqual([
      ["/label", "cm-command-name"],
      ["nope", "cm-command-arg"],
    ]);

    providers = PROVIDERS;
    cmView(view.container).dispatch({});
    expect(tokens(view.container)).toEqual([
      ["/label", "cm-command-name"],
      ["nope", "cm-command-arg cm-command-arg-invalid"],
    ]);
  });
});
