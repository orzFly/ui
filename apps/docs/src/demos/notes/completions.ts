import {
  type Completion,
  type CompletionSource,
  snippet,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { inCodeContext } from "@orz/ui-codemirror/extensions/code-context";
import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";

const FENCE = "```";

/**
 * What `/` at the start of a line inserts. `${n:…}` are the fields Tab walks through, in number
 * order; two fields with one number are typed into together, as a state's name on both lines.
 */
const BLOCKS: { label: string; detail: string; template: string }[] = [
  {
    label: "/heading",
    detail: "Section heading",
    template: `## \${1:Heading}`,
  },
  {
    label: "/todo",
    detail: "To-do list",
    template: `- [ ] \${1:First task}\n- [ ] \${2}`,
  },
  {
    label: "/table",
    detail: "Table",
    template: `| \${1:Column} | \${2:Column} |\n| --- | --- |\n| \${3} |  |`,
  },
  {
    label: "/code",
    detail: "Code block",
    template: `${FENCE}\${1:ts}\n\${2}\n${FENCE}`,
  },
  {
    label: "/flowchart",
    detail: "Diagram: flowchart",
    template: `${FENCE}mermaid\nflowchart LR\n  \${1:start} --> \${2:finish}\n${FENCE}`,
  },
  {
    label: "/sequence",
    detail: "Diagram: who sends what",
    template: `${FENCE}mermaid\nsequenceDiagram\n  \${1:alice}->>\${2:bot-one}: \${3:message}\n${FENCE}`,
  },
  {
    label: "/state",
    detail: "Diagram: states",
    template: `${FENCE}mermaid\nstateDiagram-v2\n  [*] --> \${1:Open}\n  \${1:Open} --> \${2:Done}\n${FENCE}`,
  },
];

const blocks: CompletionSource = (context) => {
  const match = context.matchBefore(/^\/[\w-]*$/);
  if (match === null) return null;
  if (inCodeContext(syntaxTree(context.state), context.pos)) return null;
  return {
    from: match.from,
    options: BLOCKS.map(
      ({ label, detail, template }): Completion => ({
        label,
        detail,
        type: "block",
        apply: snippet(template),
      }),
    ),
    validFor: /^\/[\w-]*$/,
  };
};

/**
 * `#` and a letter offers the tags already in the notebook. The letter keeps a heading's `# ` from
 * opening the panel, and the space before keeps a link's `#fragment` from it.
 */
function hashtags(tags: () => readonly [string, number][]): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/#[a-z][\w-]*$/i);
    if (match === null) return null;
    const before = context.state.sliceDoc(match.from - 1, match.from);
    if (before !== "" && !/[\s(]/.test(before)) return null;
    if (inCodeContext(syntaxTree(context.state), context.pos)) return null;
    return {
      from: match.from,
      // The tag being typed is in the notebook's count already; offered back, it completes nothing.
      options: tags()
        .filter(([tag]) => `#${tag}` !== match.text.toLowerCase())
        .map(([tag, count]) => ({
          label: `#${tag}`,
          detail: count === 1 ? "1 note" : `${count} notes`,
          type: "hashtag",
          apply: applyWithSpace(`#${tag}`),
        })),
      validFor: /^#[\w-]*$/,
    };
  };
}

const icons = EditorView.theme({
  ".cm-completionIcon-block::after": {
    content: "'/'",
    color: "var(--primary)",
  },
  ".cm-completionIcon-hashtag::after": {
    content: "'#'",
    color: "var(--primary)",
  },
});

/**
 * The notebook's completion: block templates on `/`, its tags on `#`, and — from `completionWith`
 * itself — the `<details>` template on `<det`. `tags` is read when the panel opens, so a tag
 * written in one note is offered in the next without rebuilding the extension.
 */
export function noteCompletions(
  tags: () => readonly [string, number][],
): Extension {
  return [completionWith([blocks, hashtags(tags)]), icons];
}
