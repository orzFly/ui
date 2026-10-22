import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { markdownLanguage } from "../src/components/markdown-editor.tsx";
import { commandCompletionSource } from "../src/extensions/slash-commands.ts";
import {
  type CommandDef,
  commandLinesOf,
  createCommandRegistry,
  parseCommandLines,
  recognizeCommandLine,
  slugifyCommandName,
  summarizeCommands,
} from "../src/lib/slash-commands.ts";

type Compiled =
  | { type: "close" }
  | { type: "label"; name: string }
  | { type: "hide_all"; force: boolean };

const LABELS = ["bug", "area:web", "good first issue"];

const COMMANDS: CommandDef<Compiled>[] = [
  {
    name: "close",
    argument: "none",
    detail: "→ Done",
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    argument: "required",
    detail: "add a label",
    candidates: LABELS,
    summarize: (argument) => `label ${argument}`,
    compile: (argument) =>
      LABELS.includes(argument) ? { type: "label", name: argument } : null,
  },
  {
    name: "hide-all",
    argument: "optional",
    detail: "hide every comment before this one",
    candidates: ["force"],
    summarize: (argument) =>
      argument === "" ? "hide every comment" : "hide every comment, force",
    compile: (argument) =>
      argument === "" || argument === "force"
        ? { type: "hide_all", force: argument === "force" }
        : null,
    invalidReason: (argument) =>
      `/hide-all takes nothing or "force", not "${argument}"`,
  },
];

const registry = createCommandRegistry(COMMANDS);

describe("createCommandRegistry", () => {
  it("indexes the commands by name, in the order given", () => {
    expect(registry.commands.map((c) => c.name)).toEqual([
      "close",
      "label",
      "hide-all",
    ]);
    expect(registry.byName.get("label")?.detail).toBe("add a label");
  });

  it("rejects a name no line could spell", () => {
    expect(() =>
      createCommandRegistry([
        { ...(COMMANDS[0] as CommandDef<Compiled>), name: "Close" },
      ]),
    ).toThrow(/"Close"/);
    expect(() =>
      createCommandRegistry([
        { ...(COMMANDS[0] as CommandDef<Compiled>), name: "" },
      ]),
    ).toThrow();
  });

  it("rejects a name given twice", () => {
    expect(() =>
      createCommandRegistry([...COMMANDS, COMMANDS[0] as CommandDef<Compiled>]),
    ).toThrow(/"close" is defined twice/);
  });
});

describe("slugifyCommandName", () => {
  it("lowercases and folds whitespace into hyphens", () => {
    expect(slugifyCommandName("In Progress")).toBe("in-progress");
    expect(slugifyCommandName("  Needs   Review ")).toBe("needs-review");
  });

  it("drops what a command word cannot carry", () => {
    expect(slugifyCommandName("Won't Fix")).toBe("wont-fix");
    expect(slugifyCommandName("Blocked?!")).toBe("blocked");
    expect(slugifyCommandName("需要评审")).toBe("");
  });
});

describe("recognizeCommandLine", () => {
  it("takes the rest of the line as the argument", () => {
    const parsed = recognizeCommandLine("/label good first issue", registry);
    expect(parsed?.argument).toBe("good first issue");
    expect(parsed?.compiled).toEqual({
      type: "label",
      name: "good first issue",
    });
  });

  it("recognizes but does not compile an argument naming nothing", () => {
    const parsed = recognizeCommandLine("/label nope", registry);
    expect(parsed?.argument).toBe("nope");
    expect(parsed?.compiled).toBeNull();
  });

  it("ignores unknown commands and misspellings", () => {
    expect(recognizeCommandLine("/clsoe", registry)).toBeNull();
    expect(recognizeCommandLine("/", registry)).toBeNull();
  });

  it("wants the slash at the start of the line", () => {
    expect(recognizeCommandLine("please /close", registry)).toBeNull();
    expect(recognizeCommandLine(" /close", registry)).toBeNull();
  });

  it("rejects a no-argument command with trailing words", () => {
    expect(recognizeCommandLine("/close this now", registry)).toBeNull();
    expect(recognizeCommandLine("/close   ", registry)?.argument).toBe("");
  });

  it("rejects a required-argument command with no argument", () => {
    expect(recognizeCommandLine("/label", registry)).toBeNull();
    expect(recognizeCommandLine("/label   ", registry)).toBeNull();
  });

  it("takes an optional-argument command bare or with its argument", () => {
    expect(recognizeCommandLine("/hide-all", registry)?.compiled).toEqual({
      type: "hide_all",
      force: false,
    });
    expect(recognizeCommandLine("/hide-all force", registry)?.compiled).toEqual(
      { type: "hide_all", force: true },
    );
    const wrong = parseCommandLines("/hide-all forse", registry);
    expect(wrong.commands).toEqual([]);
    expect(wrong.invalid[0]?.reason).toBe(
      '/hide-all takes nothing or "force", not "forse"',
    );
  });
});

describe("parseCommandLines", () => {
  it("strips the command lines out of the body", () => {
    const parsed = parseCommandLines(
      "Shipping this.\n/close\n/label bug",
      registry,
    );
    expect(parsed.body).toBe("Shipping this.");
    expect(parsed.commands).toEqual([
      { type: "close" },
      { type: "label", name: "bug" },
    ]);
    expect(parsed.invalid).toEqual([]);
  });

  it("keeps the surrounding prose intact, blank lines and all", () => {
    const parsed = parseCommandLines(
      "first line\n\n/close\n\nsecond line",
      registry,
    );
    expect(parsed.body).toBe("first line\n\n\nsecond line");
  });

  it("yields an empty body for a commands-only draft", () => {
    const parsed = parseCommandLines("/close", registry);
    expect(parsed.body).toBe("");
    expect(parsed.commands).toHaveLength(1);
  });

  it("leaves unknown slash lines in the body", () => {
    const parsed = parseCommandLines("/clsoe\n/close", registry);
    expect(parsed.body).toBe("/clsoe");
    expect(parsed.commands).toEqual([{ type: "close" }]);
  });

  it("never reads commands inside a fenced code block", () => {
    const parsed = parseCommandLines(
      "```sh\n/close\n```\n/label bug",
      registry,
    );
    expect(parsed.body).toBe("```sh\n/close\n```");
    expect(parsed.commands).toEqual([{ type: "label", name: "bug" }]);
  });

  it("honours tilde fences and longer closing fences", () => {
    expect(parseCommandLines("~~~\n/close\n~~~", registry).commands).toEqual(
      [],
    );
    expect(
      parseCommandLines("````\n```\n/close\n````\n/close", registry).commands,
    ).toHaveLength(1);
  });

  it("treats an unclosed fence as code to its end", () => {
    expect(parseCommandLines("```\n/close", registry).commands).toEqual([]);
  });

  it("leaves an inline-code command as prose", () => {
    const parsed = parseCommandLines("type `/close` to finish", registry);
    expect(parsed.body).toBe("type `/close` to finish");
    expect(parsed.commands).toEqual([]);
  });

  it("reports an unresolvable argument instead of guessing", () => {
    const parsed = parseCommandLines("/label nope", registry);
    expect(parsed.commands).toEqual([]);
    expect(parsed.invalid).toEqual([
      { line: "/label nope", reason: '/label: nothing named "nope"' },
    ]);
  });

  it("says a bare command has no target when it compiles to nothing", () => {
    const noop = createCommandRegistry<Compiled>([
      {
        name: "noop",
        argument: "none",
        detail: "does nothing here",
        summarize: () => "noop",
        compile: () => null,
      },
    ]);
    expect(parseCommandLines("/noop", noop).invalid).toEqual([
      { line: "/noop", reason: "/noop has no target here" },
    ]);
  });

  it("applies repeated commands in the order they appear", () => {
    const parsed = parseCommandLines(
      "/label bug\n/close\n/label area:web",
      registry,
    );
    expect(parsed.commands).toEqual([
      { type: "label", name: "bug" },
      { type: "close" },
      { type: "label", name: "area:web" },
    ]);
  });

  it("summarizes what the submit button is about to do", () => {
    const parsed = parseCommandLines("/close\n/label bug\n/hide-all", registry);
    expect(parsed.summaries).toEqual([
      "close",
      "label bug",
      "hide every comment",
    ]);
    expect(summarizeCommands(parsed.summaries)).toBe(
      "close, label bug and hide every comment",
    );
    expect(summarizeCommands(["close"])).toBe("close");
    expect(summarizeCommands([])).toBe("");
  });
});

describe("commandLinesOf (what the editor highlights)", () => {
  it("reports the line numbers carrying a command", () => {
    const found = commandLinesOf("prose\n/close\n```\n/close\n```", registry);
    expect([...found.keys()]).toEqual([1]);
  });

  it("highlights a recognized line even when its argument resolves to nothing", () => {
    const found = commandLinesOf("/label nope", registry);
    expect(found.get(0)?.compiled).toBeNull();
    expect([...found.keys()]).toEqual([0]);
  });
});

describe("commandCompletionSource (the panel)", () => {
  const source = commandCompletionSource(() => registry);
  const at = (doc: string, pos = doc.length) =>
    source(new CompletionContext(EditorState.create({ doc }), pos, false));
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

  it("offers the command's candidates once the command is typed", () => {
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
    // still the candidate the user is choosing between.
    expect(at("/label ")?.options[0]?.label).toBe("bug");
  });

  it("opens no second level for an optional command without candidates", () => {
    const bare = createCommandRegistry<Compiled>([
      {
        name: "hide-all",
        argument: "optional",
        detail: "hide every comment before this one",
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
