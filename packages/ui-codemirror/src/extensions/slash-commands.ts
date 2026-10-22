import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import {
  type CommandDef,
  type CommandRegistry,
  type CompletionSlot,
  commandCompletionSlot,
  commandLinesOf,
  filterOptions,
  providerOf,
  quoteArgument,
  slotValues,
  type ValueOption,
  type ValueProviders,
  type ValueVerdict,
} from "@orz/query";
import { inCodeContext } from "./code-context.ts";

/**
 * The editor half of slash commands (T-161): a panel to type them with, and
 * a highlight so a recognized command line is visibly different from prose.
 * Neither decides anything — `@orz/query`'s command parser is the single
 * verdict on what a line means, and it runs again at submit time on the
 * same text.
 *
 * The registry and the value providers are usually built from data that
 * loads asynchronously, so they come in through getters: rebuilding the
 * extension whenever they change would reconfigure the editor mid-typing
 * and close whatever panel was open.
 */

type ArgumentSlot = Extract<CompletionSlot, { kind: "argument" }>;

/** The whole line up to the cursor, which is all a command can occupy. */
function lineBefore(context: CompletionContext): {
  text: string;
  from: number;
} {
  const line = context.state.doc.lineAt(context.pos);
  return {
    text: line.text.slice(0, context.pos - line.from),
    from: line.from,
  };
}

function firstLevelOption<T>(command: CommandDef<T>): Completion {
  return {
    label: `/${command.name}`,
    detail: command.detail,
    type: "command",
    apply: (view, _completion, from, to) => {
      // A trailing space for the argument, then straight into the second
      // level — picking `/label` without a label is never the whole intent.
      // A command that takes no argument cannot be followed by anything on
      // this line, so the newline is completed along with it and the cursor
      // lands where the prose starts.
      const takesNone = command.args.length === 0;
      const insert = takesNone ? `/${command.name}\n` : `/${command.name} `;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      });
      if (!takesNone) startCompletion(view);
    },
  };
}

/**
 * Accepting a non-final argument inserts a space and reopens the panel for
 * the next one; the final one inserts nothing more. Inside a brace group the
 * group is still open, so neither happens.
 */
function argumentOption(
  slot: ArgumentSlot,
  lineFrom: number,
  option: ValueOption,
): Completion {
  return {
    label: option.value,
    ...(option.hint === undefined ? {} : { detail: option.hint }),
    type: "command",
    apply: (view, _completion, _from, to) => {
      const next = !slot.last && !slot.inBraces;
      const quoted = quoteArgument(slot, option.value);
      const insert = next ? `${quoted} ` : quoted;
      const from = lineFrom + slot.from;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      });
      if (next) startCompletion(view);
    },
  };
}

/**
 * A command whose remaining arguments are all optional gets a first row that
 * ends it, so Enter lands on "I am done" rather than on whatever value
 * happens to sort first. Such a command is already complete, and its values
 * are often escalations (`/hide-all force`) — a key that reads as "newline"
 * elsewhere should not reach one. Type a character and this row is gone,
 * because the argument is no longer empty.
 */
const endOfCommand: Completion = {
  label: "↵",
  detail: "end of command",
  // Equal scores are ordered by label's localeCompare, so source order
  // counts for nothing: without the boost this row sorts after `force`
  // and the whole design inverts.
  boost: 1,
  apply: (view, _completion, from, to) => {
    view.dispatch({
      changes: { from, to, insert: "\n" },
      selection: { anchor: from + 1 },
    });
  },
};

/**
 * `fetched` rows are a search provider's answer for what was typed, offered
 * as they came; filtering them again could drop what the provider matched
 * by other means than a prefix.
 */
function argumentResult(
  slot: ArgumentSlot,
  line: { text: string; from: number },
  values: readonly ValueOption[],
  fetched?: readonly ValueOption[],
): CompletionResult | null {
  // CodeMirror filters against the document text, which is what was typed
  // only when no quote or escape stands in it. Past an opening quote the
  // text after it still is; anything else is filtered here instead.
  const source = line.text.slice(slot.from);
  const quote = !slot.rest && /^['"]/.test(source) ? 1 : 0;
  const literal = fetched === undefined && source.slice(quote) === slot.typed;
  const offered = literal
    ? values
    : [...filterOptions(values, slot.typed), ...(fetched ?? [])];
  if (offered.length === 0) return null;
  const options = offered.map((o) => argumentOption(slot, line.from, o));
  const ends =
    slot.optional &&
    !slot.inBraces &&
    slot.typed === "" &&
    slot.from === slot.to;
  if (ends) options.unshift(endOfCommand);
  return {
    from: line.from + slot.from + (literal ? quote : 0),
    options,
    ...(literal ? {} : { filter: false }),
  };
}

export function commandCompletionSource<T>(
  getRegistry: () => CommandRegistry<T> | null,
  getProviders?: () => ValueProviders | null,
): (
  context: CompletionContext,
) => CompletionResult | null | Promise<CompletionResult | null> {
  return (context) => {
    const registry = getRegistry();
    if (registry === null) return null;
    const line = lineBefore(context);
    if (!line.text.startsWith("/")) return null;
    if (inCodeContext(syntaxTree(context.state), context.pos)) return null;

    const slot = commandCompletionSlot(registry, line.text);
    if (slot?.kind === "command") {
      return {
        from: line.from,
        options: registry.commands.map(firstLevelOption),
      };
    }
    if (slot?.kind !== "argument") return null;

    const provider = providerOf(slot.spec, getProviders?.() ?? undefined);
    const values = slotValues(slot, provider);
    if (values !== "fetch") return argumentResult(slot, line, values);
    if (provider === undefined || !("search" in provider)) return null;

    // Another keystroke makes this answer stale before it arrives, so the
    // request is cancelled with it rather than left to finish unread.
    const controller = new AbortController();
    context.addEventListener("abort", () => controller.abort(), {
      onDocChange: true,
    });
    const builtins = slotValues(slot);
    if (builtins === "fetch") return null;
    return provider.search(slot.typed, controller.signal).then(
      (fetched) => {
        if (context.aborted || fetched.length === 0) return null;
        return argumentResult(slot, line, builtins, fetched);
      },
      // A failed search means no panel; typing the command must still work.
      () => null,
    );
  };
}

const commandLine = Decoration.line({ class: "cm-command-line" });
const brokenCommandLine = Decoration.line({
  class: "cm-command-line cm-command-line-broken",
});
const commandName = Decoration.mark({ class: "cm-command-name" });
const argumentMark: Record<ValueVerdict, Decoration> = {
  valid: Decoration.mark({ class: "cm-command-arg" }),
  unknown: Decoration.mark({ class: "cm-command-arg" }),
  special: Decoration.mark({ class: "cm-command-arg cm-command-arg-special" }),
  invalid: Decoration.mark({ class: "cm-command-arg cm-command-arg-invalid" }),
};

function commandDecorations<T>(
  view: EditorView,
  registry: CommandRegistry<T> | null,
  providers: ValueProviders | null,
): DecorationSet {
  if (registry === null) return Decoration.none;
  const doc = view.state.doc;
  const found = commandLinesOf(
    doc.toString(),
    registry,
    providers ?? undefined,
  );
  const marks: Range<Decoration>[] = [];
  for (const [index, recognized] of found) {
    const line = doc.line(index + 1);
    marks.push(
      (recognized.compiled === null ? brokenCommandLine : commandLine).range(
        line.from,
      ),
      commandName.range(
        line.from,
        line.from + 1 + recognized.command.name.length,
      ),
    );
    for (const [i, word] of recognized.words.entries()) {
      const verdict = recognized.verdicts[i] ?? "valid";
      marks.push(
        argumentMark[verdict].range(
          line.from + word.start,
          line.from + word.end,
        ),
      );
    }
  }
  return Decoration.set(marks, true);
}

/**
 * Highlight for recognized command lines. Redrawn when the document changes
 * and when the registry or the providers finally arrive — the latter is why
 * the plugin keeps the last ones it saw rather than reading them once at
 * construction.
 */
function commandHighlight<T>(
  getRegistry: () => CommandRegistry<T> | null,
  getProviders: () => ValueProviders | null,
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      #registry: CommandRegistry<T> | null;
      #providers: ValueProviders | null;

      constructor(view: EditorView) {
        this.#registry = getRegistry();
        this.#providers = getProviders();
        this.decorations = commandDecorations(
          view,
          this.#registry,
          this.#providers,
        );
      }

      update(update: ViewUpdate) {
        const registry = getRegistry();
        const providers = getProviders();
        if (
          !update.docChanged &&
          registry === this.#registry &&
          providers === this.#providers
        ) {
          return;
        }
        this.#registry = registry;
        this.#providers = providers;
        this.decorations = commandDecorations(update.view, registry, providers);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** Tailwind's violet-500 and amber-700/400, the query highlight's colours. */
const VIOLET = "var(--color-violet-500, oklch(60.6% 0.25 292.717))";
const AMBER = "var(--color-amber-700, oklch(55.5% 0.163 48.998))";
const AMBER_DARK = "var(--color-amber-400, oklch(82.8% 0.189 84.429))";

const commandTheme = EditorView.theme({
  ".cm-command-line": {
    backgroundColor: "color-mix(in oklab, var(--primary) 18%, transparent)",
    borderRadius: "0.25rem",
  },
  ".cm-command-line-broken": {
    backgroundColor: "color-mix(in oklab, var(--destructive) 16%, transparent)",
    textDecoration: "underline wavy var(--destructive)",
    textDecorationSkipInk: "none",
  },
  ".cm-command-name": { color: "var(--primary)" },
  ".cm-command-arg": {
    backgroundColor: "color-mix(in oklab, var(--primary) 12%, transparent)",
    borderRadius: "3px",
  },
  ".cm-command-arg-special": {
    backgroundColor: `color-mix(in oklab, ${VIOLET} 15%, transparent)`,
  },
  ".cm-command-arg-invalid": {
    backgroundColor: "transparent",
    color: AMBER,
    textDecoration: `underline wavy ${AMBER}`,
    textDecorationSkipInk: "none",
  },
  ".dark & .cm-command-arg-invalid": {
    color: AMBER_DARK,
    textDecorationColor: AMBER_DARK,
  },
});

/** The highlight and theme half; the panel source is registered by the caller. */
export function commandDecoration<T>(
  getRegistry: () => CommandRegistry<T> | null,
  getProviders: () => ValueProviders | null = () => null,
): Extension {
  return [commandHighlight(getRegistry, getProviders), commandTheme];
}
