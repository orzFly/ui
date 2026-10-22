import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  type CommandDef,
  createCommandRegistry,
  type ValueProviders,
} from "@orz/query";
import { describe, expect, it } from "vitest";
import { markdownLanguage } from "../src/components/markdown-editor.tsx";
import { commandCompletionSource } from "../src/extensions/slash-commands.ts";

type Compiled =
  | { type: "close" }
  | { type: "label"; name: string }
  | { type: "hide_all"; force: boolean }
  | { type: "move"; status: string };

const LABELS = ["bug", "area:web", "good first issue"];

const COMMANDS: CommandDef<Compiled>[] = [
  {
    name: "close",
    detail: "→ Done",
    args: [],
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    detail: "add a label",
    args: [
      { name: "label", value: { kind: "named", source: "label" }, rest: true },
    ],
    summarize: ([name]) => `label ${name}`,
    compile: ([name]) =>
      typeof name === "string" && LABELS.includes(name)
        ? { type: "label", name }
        : null,
  },
  {
    name: "hide-all",
    detail: "hide every comment before this one",
    args: [
      {
        name: "force",
        value: { kind: "enum", values: ["force"] },
        optional: true,
      },
    ],
    summarize: ([force]) =>
      force === undefined ? "hide every comment" : "hide every comment, force",
    compile: ([force]) => ({ type: "hide_all", force: force === "force" }),
  },
];

const PROVIDERS: ValueProviders = {
  label: { options: LABELS.map((value) => ({ value })) },
};

const registry = createCommandRegistry(COMMANDS);

describe("commandCompletionSource (the panel)", () => {
  const source = commandCompletionSource(
    () => registry,
    () => PROVIDERS,
  );
  /** The sources here never fetch, so their answer is never a promise. */
  const at = (doc: string, pos = doc.length) => {
    const result = source(
      new CompletionContext(EditorState.create({ doc }), pos, false),
    );
    if (result instanceof Promise) throw new Error("unexpected fetch");
    return result;
  };
  // A real view for exercising `apply`: hand-rolled dispatch would not catch
  // an apply written against the wrong coordinates.
  const bareView = (doc: string) =>
    new EditorView({ state: EditorState.create({ doc }) });
  /**
   * `Completion.apply` is either a function or a snippet string, and these
   * rows use the function form; this runs one and fails loudly otherwise.
   */
  const applyAt = (
    view: EditorView,
    label: string,
    doc: string,
    from: number,
    to: number,
  ) => {
    const option = at(doc)?.options.find((o) => o.label === label);
    expect(option).toBeDefined();
    if (typeof option?.apply !== "function") {
      throw new Error(`${label} has no function apply`);
    }
    option.apply(view, option, from, to);
    return view.state.doc.toString();
  };

  it("opens the whole command list on a line-leading slash", () => {
    const result = at("/");
    expect(result?.from).toBe(0);
    expect(result?.options.map((o) => o.label)).toEqual([
      "/close",
      "/label",
      "/hide-all",
    ]);
  });

  it("shows each command's detail so the panel says where it lands", () => {
    const options = at("/")?.options ?? [];
    expect(options.find((o) => o.label === "/close")?.detail).toBe("→ Done");
    expect(options.find((o) => o.label === "/label")?.detail).toBe(
      "add a label",
    );
  });

  it("offers the argument's values once the command is typed", () => {
    expect(at("/label ")?.options.map((o) => o.label)).toEqual(LABELS);
  });

  it("leads an optional-argument panel with a row that ends the command", () => {
    const options = at("/hide-all ")?.options ?? [];
    expect(options.map((o) => o.label)).toEqual(["↵", "force"]);
    const end = options[0];
    expect(end?.detail).toBe("end of command");
    // Equal scores are ordered by label, so without the boost `force` wins
    // and Enter reaches the escalation.
    expect(end?.boost).toBeGreaterThan(0);
  });

  it("drops that row as soon as the argument has a character", () => {
    expect(at("/hide-all f")?.options.map((o) => o.label)).toEqual(["force"]);
  });

  it("keeps it away from commands whose argument is required", () => {
    // /label with nothing typed cannot end the command, so the first row is
    // still the value the user is choosing between.
    expect(at("/label ")?.options[0]?.label).toBe("bug");
  });

  it("opens no second level for an optional argument with no values", () => {
    const bare = createCommandRegistry<Compiled>([
      {
        name: "hide-all",
        detail: "hide every comment before this one",
        args: [{ name: "note", value: { kind: "free" }, optional: true }],
        summarize: () => "hide every comment",
        compile: () => ({ type: "hide_all", force: false }),
      },
    ]);
    const context = new CompletionContext(
      EditorState.create({ doc: "/hide-all " }),
      "/hide-all ".length,
      false,
    );
    expect(commandCompletionSource(() => bare)(context)).toBeNull();
  });

  it("applies the end row as a newline", () => {
    const view = bareView("/hide-all ");
    expect(applyAt(view, "↵", "/hide-all ", 10, 10)).toBe("/hide-all \n");
    expect(view.state.selection.main.anchor).toBe(11);
  });

  it("completes an argument-less command together with its newline", () => {
    const view = bareView("/clo");
    expect(applyAt(view, "/close", "/clo", 0, 4)).toBe("/close\n");
    expect(view.state.selection.main.anchor).toBe(7);
  });

  it("still stops at the trailing space for a command that takes one", () => {
    const view = bareView("/lab");
    // The argument is still to come, so the line stays open.
    expect(applyAt(view, "/label", "/lab", 0, 4)).toBe("/label ");
    expect(view.state.selection.main.anchor).toBe(7);
  });

  it("replaces only the argument already typed", () => {
    const result = at("/label ar");
    expect(result?.from).toBe("/label ".length);
  });

  it("stays shut where a command cannot live", () => {
    expect(at("please /close")).toBeNull();
    // A no-argument command has no second stage.
    expect(at("/close ")).toBeNull();
    expect(at("/clsoe ")).toBeNull();
  });

  it("stays shut inside code", () => {
    const inMarkdown = (doc: string, pos = doc.length) =>
      source(
        new CompletionContext(
          EditorState.create({ doc, extensions: markdownLanguage }),
          pos,
          false,
        ),
      );
    // The controls: the same parser outside code does open the panel.
    expect(inMarkdown("/")).not.toBeNull();
    expect(inMarkdown("`code\n/")).not.toBeNull();
    expect(inMarkdown("```\n/")).toBeNull();
    // A code span may cross a line break, so a line-leading slash can sit in one.
    expect(inMarkdown("`code\n/ and`", "`code\n/".length)).toBeNull();
  });

  it("yields nothing without a registry", () => {
    const bare = commandCompletionSource(() => null);
    expect(
      bare(new CompletionContext(EditorState.create({ doc: "/" }), 1, false)),
    ).toBeNull();
  });
});

const STATUSES = ["Todo", "In Progress", "Done"];

const positional = createCommandRegistry([
  {
    name: "move",
    detail: "change status",
    args: [
      { name: "status", value: { kind: "named", source: "status" } },
      {
        name: "assignee",
        value: { kind: "named", source: "member", special: ["@me"] },
        optional: true,
      },
    ],
    summarize: () => "move",
    compile: () => "move",
  },
  {
    name: "pair",
    detail: "two optional arguments",
    args: [
      { name: "a", value: { kind: "enum", values: ["x"] }, optional: true },
      { name: "b", value: { kind: "enum", values: ["y"] }, optional: true },
    ],
    summarize: () => "pair",
    compile: () => "pair",
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

const SNAPSHOT: ValueProviders = {
  status: { options: STATUSES.map((value) => ({ value })) },
  member: { options: [{ value: "alice" }, { value: "bot-one" }] },
};

describe("argument levels", () => {
  const source = commandCompletionSource(
    () => positional,
    () => SNAPSHOT,
  );
  const at = (doc: string) => {
    const result = source(
      new CompletionContext(EditorState.create({ doc }), doc.length, false),
    );
    if (result instanceof Promise) throw new Error("unexpected fetch");
    return result;
  };
  const accept = (doc: string, label: string) => {
    const result = at(doc);
    const option = result?.options.find((o) => o.label === label);
    if (result === null || typeof option?.apply !== "function") {
      throw new Error(`no ${label} row for ${doc}`);
    }
    const view = new EditorView({ state: EditorState.create({ doc }) });
    option.apply(view, option, result.from, doc.length);
    return {
      doc: view.state.doc.toString(),
      caret: view.state.selection.main.anchor,
    };
  };

  it("offers the second argument's values after the first", () => {
    expect(at("/move Todo ")?.options.map((o) => o.label)).toEqual([
      "↵",
      "@me",
      "alice",
      "bot-one",
    ]);
  });

  it("adds a space after a non-final argument, and nothing after the last", () => {
    expect(accept("/move In", "In Progress")).toEqual({
      doc: "/move 'In Progress' ",
      caret: 20,
    });
    expect(accept("/move Todo al", "alice")).toEqual({
      doc: "/move Todo alice",
      caret: 16,
    });
  });

  it("filters a quoted argument by what is inside the quotes", () => {
    const result = at("/move 'In P");
    expect(result?.from).toBe("/move '".length);
    expect(accept("/move 'In P", "In Progress").doc).toBe(
      "/move 'In Progress' ",
    );
  });

  it("filters an escaped argument itself", () => {
    const result = at("/move In\\ P");
    expect(result?.filter).toBe(false);
    expect(result?.options.map((o) => o.label)).toEqual(["In Progress"]);
    expect(accept("/move In\\ P", "In Progress").doc).toBe(
      "/move 'In Progress' ",
    );
  });

  it("leads with the end row while every remaining argument is optional", () => {
    expect(at("/pair ")?.options.map((o) => o.label)).toEqual(["↵", "x"]);
    expect(at("/pair x ")?.options.map((o) => o.label)).toEqual(["↵", "y"]);
    // A required argument still to come: nothing to end yet.
    expect(at("/move ")?.options[0]?.label).toBe("Todo");
  });

  it("completes one alternative inside a brace group and keeps it open", () => {
    expect(at("/assign {alice,")?.options.map((o) => o.label)).toEqual([
      "@me",
      "alice",
      "bot-one",
    ]);
    expect(accept("/assign {alice,b", "bot-one")).toEqual({
      doc: "/assign {alice,bot-one",
      caret: 22,
    });
  });
});

describe("a search provider", () => {
  it("answers asynchronously with the fetched rows after the specials", async () => {
    const asked: string[] = [];
    const providers: ValueProviders = {
      status: { options: [{ value: "Todo" }] },
      member: {
        search: async (prefix) => {
          asked.push(prefix);
          return [{ value: "alice" }, { value: "alicia" }];
        },
      },
    };
    const source = commandCompletionSource(
      () => positional,
      () => providers,
    );
    const answer = (doc: string) =>
      source(
        new CompletionContext(EditorState.create({ doc }), doc.length, false),
      );
    expect((await answer("/move Todo "))?.options.map((o) => o.label)).toEqual([
      "↵",
      "@me",
      "alice",
      "alicia",
    ]);
    // Specials are narrowed here; the provider's answer is taken as it came.
    expect(
      (await answer("/move Todo al"))?.options.map((o) => o.label),
    ).toEqual(["alice", "alicia"]);
    expect(asked).toEqual(["", "al"]);
  });

  it("opens no panel for an empty or failed answer", async () => {
    const answer = (search: () => Promise<{ value: string }[]>) =>
      commandCompletionSource(
        () => positional,
        () => ({ member: { search } }),
      )(
        new CompletionContext(
          EditorState.create({ doc: "/assign x" }),
          9,
          false,
        ),
      );
    expect(await answer(async () => [])).toBeNull();
    expect(
      await answer(async () => {
        throw new Error("offline");
      }),
    ).toBeNull();
  });
});
