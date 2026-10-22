/**
 * Slash commands (T-161), the text half. A command is an ordinary draft line
 * that happens to parse: it lives in the document, deleting the line cancels
 * it, and typing `/close` by hand is exactly as good as picking it from the
 * panel — the panel is input assistance, not the carrier. Submitting strips
 * the recognized lines out of the body and compiles each one to the caller's
 * own value.
 *
 * Everything here is pure so both the editor extension (highlighting, the
 * panel) and the caller (button label, submit) read the same verdict.
 */

export type CommandDef<T> = {
  /** The word after the slash; must match `/^[a-z0-9-]+$/`. */
  name: string;
  /** Whether the command takes an argument, and whether it may be left out. */
  argument: "none" | "required" | "optional";
  /** One-line panel description, e.g. "→ Done". */
  detail: string;
  /** Argument values the panel offers once the command word is typed. */
  candidates?: readonly string[];
  /** Summary for the submit button, e.g. "close" or "label area:web". */
  summarize: (argument: string) => string;
  /** Null when the argument names nothing that exists. */
  compile: (argument: string) => T | null;
  /** Why this argument compiled to nothing; a generic message otherwise. */
  invalidReason?: (argument: string) => string;
};

export type CommandRegistry<T> = {
  commands: readonly CommandDef<T>[];
  byName: ReadonlyMap<string, CommandDef<T>>;
};

const COMMAND_NAME = /^[a-z0-9-]+$/;

/**
 * Throws on a name no line could ever spell and on a name given twice, which
 * would silently shadow the first: both are mistakes in the caller's list,
 * not in user input.
 */
export function createCommandRegistry<T>(
  commands: CommandDef<T>[],
): CommandRegistry<T> {
  const byName = new Map<string, CommandDef<T>>();
  for (const command of commands) {
    if (!COMMAND_NAME.test(command.name)) {
      throw new Error(
        `slash command "${command.name}" must match ${COMMAND_NAME}`,
      );
    }
    if (byName.has(command.name)) {
      throw new Error(`slash command "${command.name}" is defined twice`);
    }
    byName.set(command.name, command);
  }
  return { commands, byName };
}

/**
 * `In Progress` → `in-progress`. Lowercase, whitespace folded to hyphens,
 * everything a slash command cannot carry dropped: a status named `Won't
 * fix` still gets a typeable command.
 */
export function slugifyCommandName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export type RecognizedLine<T> = {
  command: CommandDef<T>;
  /** Everything after the command word, trimmed; "" when none was typed. */
  argument: string;
  /** Null when the argument names nothing that exists. */
  compiled: T | null;
};

/**
 * Does this line, on its own, spell a command? Only whole lines count: a `/`
 * mid-sentence is prose, and prose is the default — an unknown `/clsoe` is
 * left exactly where it was typed rather than guessed at.
 */
export function recognizeCommandLine<T>(
  line: string,
  registry: CommandRegistry<T>,
): RecognizedLine<T> | null {
  if (!line.startsWith("/")) return null;
  const match = /^\/([a-z0-9-]+)(?:[ \t]+([\s\S]*))?$/.exec(line.trimEnd());
  if (match === null) return null;
  const command = registry.byName.get(match[1] as string);
  if (command === undefined) return null;
  // The argument is the rest of the line, so label names with spaces need no
  // quoting; a no-argument command with trailing words is not that command.
  const argument = (match[2] ?? "").trim();
  if (command.argument === "none" && argument !== "") return null;
  if (command.argument === "required" && argument === "") return null;
  return { command, argument, compiled: command.compile(argument) };
}

export type ParsedDraft<T> = {
  /** The draft with every recognized command line removed. */
  body: string;
  commands: T[];
  /** Recognized but unresolvable — an argument that names nothing. */
  invalid: { line: string; reason: string }[];
  /** Submit-button material: one summary per recognized command, in order. */
  summaries: string[];
};

/**
 * Which lines a fenced code block covers. Line-based on purpose: 4-space code
 * blocks cannot be told from list continuations without a full markdown parse.
 */
function fencedLines(lines: string[]): boolean[] {
  const inCode = lines.map(() => false);
  let fence: { char: string; len: number } | null = null;
  for (const [i, line] of lines.entries()) {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open?.[1] !== undefined) {
      const char = open[1][0] as string;
      const len = open[1].length;
      if (fence === null) {
        fence = { char, len };
        inCode[i] = true;
        continue;
      }
      if (char === fence.char && len >= fence.len) {
        fence = null;
        inCode[i] = true;
        continue;
      }
    }
    if (fence !== null) inCode[i] = true;
  }
  return inCode;
}

/** Line indices (0-based) that carry a recognized command. */
export function commandLinesOf<T>(
  text: string,
  registry: CommandRegistry<T>,
): Map<number, RecognizedLine<T>> {
  const lines = text.split("\n");
  const inCode = fencedLines(lines);
  const found = new Map<number, RecognizedLine<T>>();
  for (const [i, line] of lines.entries()) {
    if (inCode[i]) continue;
    const recognized = recognizeCommandLine(line, registry);
    if (recognized !== null) found.set(i, recognized);
  }
  return found;
}

export function parseCommandLines<T>(
  text: string,
  registry: CommandRegistry<T>,
): ParsedDraft<T> {
  const lines = text.split("\n");
  const found = commandLinesOf(text, registry);
  const commands: T[] = [];
  const invalid: { line: string; reason: string }[] = [];
  const summaries: string[] = [];
  const kept: string[] = [];

  for (const [i, line] of lines.entries()) {
    const recognized = found.get(i);
    if (recognized === undefined) {
      kept.push(line);
      continue;
    }
    if (recognized.compiled === null) {
      const { command, argument } = recognized;
      invalid.push({
        line: line.trim(),
        reason:
          command.invalidReason?.(argument) ??
          (argument === ""
            ? `/${command.name} has no target here`
            : `/${command.name}: nothing named "${argument}"`),
      });
      continue;
    }
    commands.push(recognized.compiled);
    summaries.push(recognized.command.summarize(recognized.argument));
  }

  return { body: kept.join("\n").trim(), commands, invalid, summaries };
}

/** "close" / "close and label bug" — the tail of the submit button's label. */
export function summarizeCommands(summaries: string[]): string {
  if (summaries.length <= 1) return summaries.join("");
  return `${summaries.slice(0, -1).join(", ")} and ${summaries.at(-1)}`;
}
