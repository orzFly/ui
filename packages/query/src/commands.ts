/**
 * Slash commands (T-161), the text half. A command is an ordinary draft line
 * that happens to parse: it lives in the document, deleting the line cancels
 * it, and typing `/close` by hand is exactly as good as picking it from the
 * panel — the panel is input assistance, not the carrier. Submitting strips
 * the recognized lines out of the body and compiles each one to the caller's
 * own value.
 *
 * Everything here is pure so both an editor (highlighting, the panel) and
 * the caller (button label, submit) read the same verdict, and a server or a
 * CLI can read a draft without an editor at all.
 */

import { BRACE_LIMIT, expandBraces } from "./braces.ts";
import { type ShellWord, shellWords } from "./shell-words.ts";
import { didYouMean } from "./suggest.ts";
import {
  providerOf,
  suggestionCandidates,
  type ValueProvider,
  type ValueProviders,
  type ValueSpec,
  type ValueVerdict,
  valueVerdict,
  worstVerdict,
} from "./values.ts";

export type ArgSpec = {
  /** Shown in the panel: "<label>". */
  name: string;
  value: ValueSpec;
  /** Only trailing arguments may be optional. */
  optional?: boolean;
  /** The last argument may take the rest of the line. */
  rest?: boolean;
  /** Brace expansion applies, and the argument is a list. */
  multiple?: boolean;
};

/** `string` for a plain argument, `readonly string[]` for a `multiple` one. */
export type ArgValue = string | readonly string[];

/**
 * `args` handed to `summarize`, `compile` and `invalidReason` are positional:
 * an optional argument that was not typed is absent, so the array is shorter.
 */
export type CommandDef<T> = {
  /** The word after the slash; must match `/^[a-z0-9-]+$/`. */
  name: string;
  /** One-line panel description, e.g. "→ Done". */
  detail: string;
  args: readonly ArgSpec[];
  /** Summary for the submit button, e.g. "close" or "label area:web". */
  summarize: (args: readonly ArgValue[]) => string;
  /** Null when the arguments name nothing that exists. */
  compile: (args: readonly ArgValue[]) => T | null;
  /** Why these arguments compiled to nothing; a generic message otherwise. */
  invalidReason?: (args: readonly ArgValue[]) => string;
};

export type CommandRegistry<T> = {
  commands: readonly CommandDef<T>[];
  byName: ReadonlyMap<string, CommandDef<T>>;
};

const COMMAND_NAME = /^[a-z0-9-]+$/;

/**
 * Throws on a name no line could ever spell and on a name given twice, which
 * would silently shadow the first: both are mistakes in the caller's list,
 * not in user input. So are a required argument after an optional one and a
 * rest argument that is not last, since no line could reach them.
 */
export function createCommandRegistry<T>(
  commands: readonly CommandDef<T>[],
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
    for (const [i, arg] of command.args.entries()) {
      const next = command.args[i + 1];
      if (next === undefined) continue;
      if (arg.optional && !next.optional) {
        throw new Error(
          `slash command "${command.name}": required argument "${next.name}" follows optional "${arg.name}"`,
        );
      }
      if (arg.rest) {
        throw new Error(
          `slash command "${command.name}": only the last argument may take the rest of the line, not "${arg.name}"`,
        );
      }
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
  /**
   * One word per argument typed, in the order of `args`, with offsets in the
   * line. An unquoted rest argument is one word over the raw remainder.
   */
  words: ShellWord[];
  args: ArgValue[];
  /**
   * Each argument's verdict; a `multiple` one has the worst among its
   * values, and an unclosed quote or a failed expansion is `invalid`.
   */
  verdicts: ValueVerdict[];
  /** Null: recognized, but broken. */
  compiled: T | null;
  /** Why it is broken. */
  reason?: string;
};

const COMMAND_HEAD = /^\/([a-z0-9-]+)(?:[ \t]|$)/;

/** A rest argument's remainder, read with no quoting at all. */
export function rawWord(text: string, start: number): ShellWord {
  const raw = text.slice(start);
  return {
    start,
    end: text.length,
    raw,
    value: raw,
    segments: [{ start, end: text.length, quoted: "none" }],
  };
}

/**
 * The words after the command name, one per argument, or null when there
 * are too few for the required arguments or too many for the command: then
 * the line is not that command and stays prose, so `/close the door` is a
 * sentence. An open quote swallows the words after it, so with one the line
 * still counts when it has too few: it is reported broken, not posted.
 *
 * A rest argument whose text does not start with a quote is the raw
 * remainder, so `/label In Progress` and `/status Won't fix` need no quoting
 * and no escape is processed. A quoted one is a shell word like any other.
 */
function argumentWords<T>(
  command: CommandDef<T>,
  text: string,
  nameEnd: number,
): ShellWord[] | null {
  const words = shellWords(text.slice(nameEnd), nameEnd);
  const last = command.args.length - 1;
  const head = words[last];
  if (
    command.args[last]?.rest &&
    head !== undefined &&
    !/^['"]/.test(head.raw)
  ) {
    words.splice(last, words.length - last, rawWord(text, head.start));
  }
  const required = command.args.filter((arg) => !arg.optional).length;
  const unclosed = words.at(-1)?.unclosed === true;
  if (
    (!unclosed && words.length < required) ||
    words.length > command.args.length
  ) {
    return null;
  }
  return words;
}

function invalidMessage(
  spec: ValueSpec,
  value: string,
  provider: ValueProvider | undefined,
): string {
  const message =
    spec.kind === "enum"
      ? `"${value}" is not one of ${spec.values.join(", ")}`
      : `nothing named "${value}"`;
  const suggestion = didYouMean(value, suggestionCandidates(spec, provider));
  return suggestion === null
    ? message
    : `${message} (did you mean "${suggestion}"?)`;
}

/**
 * Does this line, on its own, spell a command? Only whole lines count: a `/`
 * mid-sentence is prose, and prose is the default — an unknown `/clsoe` is
 * left exactly where it was typed rather than guessed at.
 *
 * A recognized line is broken, and `compile` is not called, when a quote is
 * left open, a brace expansion goes over the limit, or a value has an
 * `invalid` verdict. Otherwise `compile` runs and stays the authority.
 */
export function recognizeCommandLine<T>(
  line: string,
  registry: CommandRegistry<T>,
  providers?: ValueProviders,
): RecognizedLine<T> | null {
  if (!line.startsWith("/")) return null;
  const text = line.trimEnd();
  const match = COMMAND_HEAD.exec(text);
  if (match === null) return null;
  const name = match[1] as string;
  const command = registry.byName.get(name);
  if (command === undefined) return null;
  const nameEnd = name.length + 1;
  const words = argumentWords(command, text, nameEnd);
  if (words === null) return null;

  const args: ArgValue[] = [];
  const verdicts: ValueVerdict[] = [];
  let reason: string | undefined;
  const fail = (why: string) => {
    reason ??= `/${command.name}: ${why}`;
  };
  for (const [i, word] of words.entries()) {
    const spec = command.args[i] as ArgSpec;
    const provider = providerOf(spec.value, providers);
    if (word.unclosed) fail("unclosed quote");
    let values: string[] = [word.value];
    if (spec.multiple) {
      const expansion = expandBraces(word, { limit: BRACE_LIMIT });
      if (!expansion.ok) {
        fail(`"${word.value}" ${expansion.reason}`);
        args.push(values);
        verdicts.push("invalid");
        continue;
      }
      values = expansion.words;
      args.push(values);
    } else {
      args.push(word.value);
    }
    const each = values.map((value) => {
      const verdict = valueVerdict(spec.value, value, provider);
      if (verdict === "invalid") {
        fail(invalidMessage(spec.value, value, provider));
      }
      return verdict;
    });
    const worst = worstVerdict(each) ?? "valid";
    verdicts.push(word.unclosed ? "invalid" : worst);
  }

  if (reason !== undefined) {
    return { command, words, args, verdicts, compiled: null, reason };
  }
  const compiled = command.compile(args);
  if (compiled !== null) return { command, words, args, verdicts, compiled };
  const typed = text.slice(nameEnd).trim();
  return {
    command,
    words,
    args,
    verdicts,
    compiled,
    reason:
      command.invalidReason?.(args) ??
      (typed === ""
        ? `/${command.name} has no target here`
        : `/${command.name}: nothing named "${typed}"`),
  };
}

export type ParsedDraft<T> = {
  /** The draft with every recognized command line removed. */
  body: string;
  commands: T[];
  /** Recognized but broken — an argument that names nothing, say. */
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
  providers?: ValueProviders,
): Map<number, RecognizedLine<T>> {
  const lines = text.split("\n");
  const inCode = fencedLines(lines);
  const found = new Map<number, RecognizedLine<T>>();
  for (const [i, line] of lines.entries()) {
    if (inCode[i]) continue;
    const recognized = recognizeCommandLine(line, registry, providers);
    if (recognized !== null) found.set(i, recognized);
  }
  return found;
}

export function parseCommandLines<T>(
  text: string,
  registry: CommandRegistry<T>,
  providers?: ValueProviders,
): ParsedDraft<T> {
  const lines = text.split("\n");
  const found = commandLinesOf(text, registry, providers);
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
      invalid.push({ line: line.trim(), reason: recognized.reason ?? "" });
      continue;
    }
    commands.push(recognized.compiled);
    summaries.push(recognized.command.summarize(recognized.args));
  }

  return { body: kept.join("\n").trim(), commands, invalid, summaries };
}

/** "close" / "close and label bug" — the tail of the submit button's label. */
export function summarizeCommands(summaries: readonly string[]): string {
  if (summaries.length <= 1) return summaries.join("");
  return `${summaries.slice(0, -1).join(", ")} and ${summaries.at(-1)}`;
}
