import { describe, expect, it } from "vitest";
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
