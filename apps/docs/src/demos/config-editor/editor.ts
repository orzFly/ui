import { Prec, StateField } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import { checkJson, type JsonProblem } from "./json-check.ts";

/** Names the message under the editor, which reads the same problem. */
export const PROBLEM_ID = "config-problem";

const problemMark = Decoration.mark({ class: "cm-json-problem" });

/** The first problem in the document, the one named under the editor. */
const problemField = StateField.define<JsonProblem | null>({
  create: (state) => checkJson(state.doc.toString()),
  update: (problem, transaction) =>
    transaction.docChanged
      ? checkJson(transaction.state.doc.toString())
      : problem,
  provide: (field) => [
    EditorView.decorations.compute([field], (state) => {
      const problem = state.field(field);
      // At the end of the file there is no character left to underline.
      if (problem === null || problem.from === problem.to) {
        return Decoration.none;
      }
      return Decoration.set(problemMark.range(problem.from, problem.to));
    }),
    EditorView.contentAttributes.of((view) =>
      view.state.field(field) === null
        ? null
        : { "aria-invalid": "true", "aria-describedby": PROBLEM_ID },
    ),
  ],
});

// CodeEditor is a prose shell: no gutter, the page's sans font. A config file reads by line, in
// code's own type: 13px whatever size a style sets prose in, from md up, where the shell's 16px
// (which keeps iOS from zooming into the focused editor) gives way.
const configTheme = Prec.highest(
  EditorView.theme({
    "@media (min-width: 48rem)": { ".cm-scroller": { fontSize: "13px" } },
    ".cm-scroller": { fontFamily: "var(--font-mono)" },
    ".cm-gutters": {
      display: "flex",
      // The content's, so each number sits on its line's baseline.
      lineHeight: "1.5",
      backgroundColor: "transparent",
      border: "none",
      color: "var(--muted-foreground)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 0.5rem 0 0.75rem",
      minWidth: "2.5rem",
    },
    ".cm-content": { paddingLeft: "0.25rem" },
    ".cm-json-problem": {
      textDecoration: "underline wavy var(--destructive)",
      textUnderlineOffset: "3px",
    },
  }),
);

// The shell's prose niceties would "correct" keys and values.
const codeInput = Prec.highest(
  EditorView.contentAttributes.of({
    spellcheck: "false",
    autocapitalize: "off",
    autocorrect: "off",
  }),
);

/** What a config file adds to the CodeEditor shell; built once, as CodeEditor reconfigures on a new one. */
export const configExtensions = [
  lineNumbers(),
  problemField,
  codeInput,
  configTheme,
];
