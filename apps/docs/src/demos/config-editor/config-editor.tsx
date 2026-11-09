import type { EditorView } from "@codemirror/view";
import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orz/ui/components/dialog";
import {
  NavList,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { CodeDiffBlock } from "@orz/ui-code";
import { CodeEditor } from "@orz/ui-codemirror/components/code-editor";
import { jsonSupport } from "@orz/ui-codemirror/extensions/json";
import { CircleAlertIcon, CircleCheckIcon, FileJsonIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { configExtensions, PROBLEM_ID } from "./editor.ts";
import { CONFIG_FILES } from "./files.ts";
import { checkJson } from "./json-check.ts";

type Texts = Record<string, string>;

const initialTexts = (): Texts =>
  Object.fromEntries(
    CONFIG_FILES.map(({ name, contents }) => [name, contents]),
  );

/**
 * A JSON config editor: a file list beside the open file, its first syntax error named by line
 * under the editor, the edits reviewed as a diff before they are saved, and a prompt before
 * switching away from unsaved ones. Saves last as long as the page.
 */
export function ConfigEditor() {
  const [saved, setSaved] = useState(initialTexts);
  const [drafts, setDrafts] = useState(initialTexts);
  const [name, setName] = useState(CONFIG_FILES[0]?.name ?? "");
  // Bumped when the draft changes under the editor (a discard, its undo), so it reopens on the new text.
  const [revision, setRevision] = useState(0);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const view = useRef<EditorView | null>(null);

  const draft = drafts[name] ?? "";
  const before = saved[name] ?? "";
  const dirty = draft !== before;
  const problem = checkJson(draft);
  const anyDirty = CONFIG_FILES.some(
    (file) => drafts[file.name] !== saved[file.name],
  );

  useEffect(() => {
    if (!anyDirty) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [anyDirty]);

  const open = (next: string) => {
    if (next === name) return;
    if (dirty) setLeavingTo(next);
    else setName(next);
  };

  const save = () => {
    if (!dirty || problem !== null) return;
    setSaved((was) => ({ ...was, [name]: draft }));
    setReviewing(false);
    toast.success(`${name} saved`);
  };
  // The editor binds its keys once, at mount; Mod-S calls whatever save is current.
  const saveNow = useRef(save);
  saveNow.current = save;
  const [keys] = useState(() => [
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => {
        saveNow.current();
        return true;
      },
    },
  ]);

  const discard = () => {
    const file = name;
    const lost = draft;
    setDrafts((was) => ({ ...was, [file]: saved[file] ?? "" }));
    setRevision((count) => count + 1);
    setReviewing(false);
    toast(`Changes to ${file} discarded`, {
      action: {
        label: "Undo",
        onClick: () => {
          setDrafts((was) => ({ ...was, [file]: lost }));
          setName(file);
          setRevision((count) => count + 1);
        },
      },
    });
  };

  const showProblem = () => {
    const current = view.current;
    if (!current || problem === null) return;
    current.dispatch({
      selection: { anchor: problem.from },
      scrollIntoView: true,
    });
    current.focus();
  };

  return (
    <Pane purpose="app" className="flex h-full overflow-hidden max-md:flex-col">
      <Pane
        purpose="sidebar"
        edge={{ initial: "bottom", md: "end" }}
        className="flex shrink-0 flex-col p-2 md:w-56 md:p-3"
      >
        <NavListFrame className="flex min-h-0 flex-1 flex-col">
          <nav aria-label="Files" className="min-h-0 flex-1 md:overflow-y-auto">
            {/* Three across on a phone, where a column would push the editor down. */}
            <NavList className="max-md:grid max-md:grid-cols-3">
              {CONFIG_FILES.map((file) => {
                const unsaved = drafts[file.name] !== saved[file.name];
                return (
                  <NavListItem key={file.name} className="min-w-0">
                    <NavListLink current={file.name === name} asChild>
                      <button type="button" onClick={() => open(file.name)}>
                        <FileJsonIcon className="max-md:hidden" />
                        <span className="truncate font-mono">{file.name}</span>
                        {unsaved && (
                          <span className="ml-auto size-2 shrink-0 rounded-full bg-primary">
                            <span className="sr-only">, unsaved</span>
                          </span>
                        )}
                      </button>
                    </NavListLink>
                  </NavListItem>
                );
              })}
            </NavList>
          </nav>
        </NavListFrame>
      </Pane>
      <Pane purpose="panel" asChild>
        <section
          aria-labelledby="config-file-title"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <Pane purpose="toolbar" edge="bottom" asChild>
            <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
              <div className="flex min-w-0 items-baseline gap-2">
                <h2
                  id="config-file-title"
                  className="truncate font-mono font-semibold text-ui"
                >
                  {name}
                </h2>
                {dirty && (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-ui-sm">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-primary"
                    />
                    Unsaved
                  </span>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dirty}
                  onClick={() => setReviewing(true)}
                >
                  Review changes
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || problem !== null}
                  aria-keyshortcuts="Control+S Meta+S"
                  onClick={save}
                >
                  Save
                </Button>
              </div>
            </header>
          </Pane>
          <CodeEditor
            key={`${name}:${revision}`}
            initialValue={draft}
            ariaLabel={name}
            language={jsonSupport}
            extensions={configExtensions}
            keymap={keys}
            ownerManagedDirty
            onChange={(text) => setDrafts((was) => ({ ...was, [name]: text }))}
            onView={(next) => {
              view.current = next;
            }}
            purpose="document"
            className="min-h-0 flex-1 py-1"
          />
          <Pane purpose="statusbar" asChild>
            <footer
              id={PROBLEM_ID}
              className="flex min-h-9 shrink-0 items-center px-3 md:px-4"
            >
              {problem === null ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleCheckIcon className="size-3.5" />
                  Valid JSON · {draft.split("\n").length} lines
                </span>
              ) : (
                // Stretched rather than min-h-9, so a style that tightens the bar brings it in too.
                <button
                  type="button"
                  onClick={showProblem}
                  className="flex items-center gap-1.5 self-stretch text-left text-destructive hover:underline touch:min-h-11"
                >
                  <CircleAlertIcon className="size-3.5 shrink-0" />
                  Line {problem.line}: {problem.message}
                </button>
              )}
            </footer>
          </Pane>
        </section>
      </Pane>
      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Changes to {name}</DialogTitle>
            <DialogDescription>
              What the saved file loses in red, what your edits add in green.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Pane purpose="document">
              <CodeDiffBlock filename={name} before={before} after={draft} />
            </Pane>
          </DialogBody>
          <DialogFooter className="items-center">
            {problem !== null && (
              <p className="mr-auto text-destructive text-ui-sm">
                Line {problem.line}: {problem.message}
              </p>
            )}
            <Button variant="ghost" onClick={discard}>
              Discard changes
            </Button>
            <Button disabled={problem !== null} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={leavingTo !== null}
        onStay={() => setLeavingTo(null)}
        onProceed={() => {
          setDrafts((was) => ({ ...was, [name]: before }));
          setRevision((count) => count + 1);
          if (leavingTo !== null) setName(leavingTo);
          setLeavingTo(null);
        }}
      />
    </Pane>
  );
}
