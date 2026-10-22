import { describe, expect, it, vi } from "vitest";
import {
  type ArgValue,
  type CommandDef,
  commandLinesOf,
  createCommandRegistry,
  parseCommandLines,
  recognizeCommandLine,
  slugifyCommandName,
  summarizeCommands,
} from "../src/commands.ts";
import type { ValueProviders } from "../src/values.ts";

type Compiled =
  | { type: "close" }
  | { type: "label"; name: string }
  | { type: "hide_all"; force: boolean };

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
    invalidReason: ([force]) =>
      `/hide-all takes nothing or "force", not "${force}"`,
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

  it("rejects a required argument after an optional one", () => {
    expect(() =>
      createCommandRegistry([
        {
          ...(COMMANDS[0] as CommandDef<Compiled>),
          args: [
            { name: "a", value: { kind: "free" }, optional: true },
            { name: "b", value: { kind: "free" } },
          ],
        },
      ]),
    ).toThrow(/required argument "b" follows optional "a"/);
  });

  it("rejects a rest argument that is not the last", () => {
    expect(() =>
      createCommandRegistry([
        {
          ...(COMMANDS[0] as CommandDef<Compiled>),
          args: [
            { name: "a", value: { kind: "free" }, rest: true },
            { name: "b", value: { kind: "free" } },
          ],
        },
      ]),
    ).toThrow(/not "a"/);
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
    expect(parsed?.args).toEqual(["good first issue"]);
    expect(parsed?.compiled).toEqual({
      type: "label",
      name: "good first issue",
    });
  });

  it("recognizes but does not compile an argument naming nothing", () => {
    const parsed = recognizeCommandLine("/label nope", registry);
    expect(parsed?.args).toEqual(["nope"]);
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
    expect(recognizeCommandLine("/close   ", registry)?.args).toEqual([]);
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
    // The enum check runs before `compile`, so its message wins over the
    // command's own `invalidReason`, which is for what `compile` refuses.
    const wrong = parseCommandLines("/hide-all forse", registry);
    expect(wrong.commands).toEqual([]);
    expect(wrong.invalid[0]?.reason).toBe(
      '/hide-all: "forse" is not one of force (did you mean "force"?)',
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
        detail: "does nothing here",
        args: [],
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

/** The positional commands the widened engine exists for. */
type Action =
  | { type: "move"; status: string; assignee?: string }
  | { type: "assign"; logins: readonly string[] }
  | { type: "tag"; names: readonly string[] }
  | { type: "status"; name: string }
  | { type: "pair"; a?: string; b?: string };

const list = (value: ArgValue | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const PROVIDERS: ValueProviders = {
  status: {
    options: [
      { value: "Todo" },
      { value: "In Progress" },
      { value: "Won't fix" },
    ],
  },
  member: {
    options: [{ value: "alice" }, { value: "bot-one" }, { value: "newcomer" }],
  },
};

const compileMove = vi.fn(([status, assignee]: readonly ArgValue[]) => ({
  type: "move" as const,
  status: status as string,
  ...(assignee === undefined ? {} : { assignee: assignee as string }),
}));

const positional = createCommandRegistry<Action>([
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
    summarize: ([status]) => `move to ${status}`,
    compile: compileMove,
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
    summarize: ([logins]) => `assign ${list(logins).join(", ")}`,
    compile: ([logins]) => ({ type: "assign", logins: list(logins) }),
  },
  {
    name: "tag",
    detail: "add free-form tags",
    args: [
      { name: "tag", value: { kind: "free" }, rest: true, multiple: true },
    ],
    summarize: ([names]) => `tag ${list(names).join(", ")}`,
    compile: ([names]) => ({ type: "tag", names: list(names) }),
  },
  {
    name: "status",
    detail: "set the status",
    args: [{ name: "status", value: { kind: "free" }, rest: true }],
    summarize: ([name]) => `status ${name}`,
    compile: ([name]) => ({ type: "status", name: name as string }),
  },
  {
    name: "pair",
    detail: "two optional arguments",
    args: [
      { name: "a", value: { kind: "free" }, optional: true },
      { name: "b", value: { kind: "free" }, optional: true },
    ],
    summarize: () => "pair",
    compile: ([a, b]) => ({
      type: "pair",
      ...(a === undefined ? {} : { a: a as string }),
      ...(b === undefined ? {} : { b: b as string }),
    }),
  },
]);

const recognize = (line: string) =>
  recognizeCommandLine(line, positional, PROVIDERS);

describe("positional arguments", () => {
  it("reads each argument in order and leaves an optional tail absent", () => {
    expect(recognize("/move Todo")?.args).toEqual(["Todo"]);
    expect(recognize("/move Todo alice")?.args).toEqual(["Todo", "alice"]);
    expect(recognize("/move Todo alice")?.compiled).toEqual({
      type: "move",
      status: "Todo",
      assignee: "alice",
    });
  });

  it("is prose with too few or too many words", () => {
    expect(recognize("/move")).toBeNull();
    expect(recognize("/move Todo alice now")).toBeNull();
  });

  it("takes any prefix of an optional tail", () => {
    expect(recognize("/pair")?.compiled).toEqual({ type: "pair" });
    expect(recognize("/pair x")?.compiled).toEqual({ type: "pair", a: "x" });
    expect(recognize("/pair x y")?.compiled).toEqual({
      type: "pair",
      a: "x",
      b: "y",
    });
    expect(recognize("/pair x y z")).toBeNull();
  });

  it("reads quoted words as one argument, with offsets in the line", () => {
    const parsed = recognize("/move 'In Progress' alice");
    expect(parsed?.args).toEqual(["In Progress", "alice"]);
    expect(parsed?.words.map((w) => [w.start, w.end])).toEqual([
      [6, 19],
      [20, 25],
    ]);
    expect(recognize('/move "Won\'t fix"')?.args).toEqual(["Won't fix"]);
    expect(recognize("/move Won\\'t\\ fix")?.args).toEqual(["Won't fix"]);
  });
});

describe("a rest argument", () => {
  it("takes the raw remainder, apostrophes and inner spaces kept", () => {
    expect(recognize("/status Won't fix")?.args).toEqual(["Won't fix"]);
    expect(recognize("/status  In   Progress  ")?.args).toEqual([
      "In   Progress",
    ]);
    // No escape is processed in the raw remainder.
    expect(recognize("/status C:\\temp")?.args).toEqual(["C:\\temp"]);
  });

  it("is one shell word when it starts with a quote", () => {
    expect(recognize('/status "In Progress"')?.args).toEqual(["In Progress"]);
    expect(recognize("/status 'In Progress' now")).toBeNull();
  });

  it("is one word over the remainder, for painting", () => {
    const words = recognize("/status Won't fix")?.words ?? [];
    expect(words.map((w) => [w.start, w.end, w.raw])).toEqual([
      [8, 17, "Won't fix"],
    ]);
  });
});

describe("multiple arguments", () => {
  it("receive a list, even of one", () => {
    expect(recognize("/assign alice")?.args).toEqual([["alice"]]);
    expect(recognize("/assign {alice,bot-one}")?.compiled).toEqual({
      type: "assign",
      logins: ["alice", "bot-one"],
    });
  });

  it("keep quoted braces and commas literal", () => {
    expect(recognize("/tag '{a,b}'")?.args).toEqual([["{a,b}"]]);
    const unchecked = (line: string) =>
      recognizeCommandLine(line, positional)?.args;
    expect(unchecked("/assign x\\{a,b}")).toEqual([["x{a,b}"]]);
    expect(unchecked("/assign {alice\\,bot-one,x}")).toEqual([
      ["alice,bot-one", "x"],
    ]);
  });

  it("read no escapes in a raw rest remainder", () => {
    expect(recognize("/tag x\\{a,b}")?.args).toEqual([["x\\a", "x\\b"]]);
  });

  it("leave braces ordinary in every other argument", () => {
    const parsed = recognizeCommandLine("/move {Todo,Done}", positional);
    expect(parsed?.args).toEqual(["{Todo,Done}"]);
    expect(recognize("/status {In,Not} Progress")?.args).toEqual([
      "{In,Not} Progress",
    ]);
  });

  it("expand a rest remainder as one unquoted string", () => {
    expect(recognize("/tag {In,Not} Progress")?.args).toEqual([
      ["In Progress", "Not Progress"],
    ]);
  });

  it("break the line past the expansion limit", () => {
    const parsed = recognize(`/tag ${"{a,b}".repeat(7)}`);
    expect(parsed?.compiled).toBeNull();
    expect(parsed?.reason).toMatch(/expands to more than 64 values/);
    expect(parsed?.verdicts).toEqual(["invalid"]);
  });
});

describe("value checks before compile", () => {
  it("break a line whose named value the provider does not hold", () => {
    compileMove.mockClear();
    const parsed = recognize("/move Tood");
    expect(parsed?.compiled).toBeNull();
    expect(parsed?.reason).toBe(
      '/move: nothing named "Tood" (did you mean "Todo"?)',
    );
    expect(compileMove).not.toHaveBeenCalled();
  });

  it("leave a named value to compile when nothing can tell", () => {
    compileMove.mockClear();
    const parsed = recognizeCommandLine("/move Tood", positional);
    expect(parsed?.verdicts).toEqual(["unknown"]);
    expect(compileMove).toHaveBeenCalledOnce();
  });

  it("check every element of a list on its own", () => {
    const parsed = recognize("/assign {alice,nobody,bot-one}");
    expect(parsed?.compiled).toBeNull();
    expect(parsed?.reason).toBe('/assign: nothing named "nobody"');
    expect(parsed?.verdicts).toEqual(["invalid"]);
  });

  it("paint a list by its worst value", () => {
    expect(recognize("/assign {alice,@me}")?.verdicts).toEqual(["special"]);
    expect(recognize("/move Todo @ME")?.verdicts).toEqual(["valid", "special"]);
  });

  it("break a line with a quote left open", () => {
    const parsed = recognize("/move 'In Progress");
    expect(parsed?.compiled).toBeNull();
    expect(parsed?.reason).toBe("/move: unclosed quote");
    expect(parseCommandLines("/move 'In Progress", positional).invalid).toEqual(
      [{ line: "/move 'In Progress", reason: "/move: unclosed quote" }],
    );
  });

  it("hand the parsed lists to summarize", () => {
    expect(
      parseCommandLines("/assign {alice,bot-one}", positional, PROVIDERS)
        .summaries,
    ).toEqual(["assign alice, bot-one"]);
  });
});
