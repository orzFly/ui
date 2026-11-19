import { Button } from "@orz/ui/components/button";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";
import {
  stagedFileDrag,
  useStagedFiles,
} from "@orz/ui-codemirror/hooks/use-staged-files";
import { PaperclipIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

/** Stands in for the app's upload: the file "arrives" a moment later. */
const upload = (file: File) =>
  new Promise<{ url: string }>((resolve) =>
    setTimeout(
      () =>
        resolve({
          url: `https://files.example/${encodeURIComponent(file.name)}`,
        }),
      300,
    ),
  );

export function CommentWithFiles() {
  const staging = useStagedFiles({ upload });
  const editor = useRef<MarkdownEditorHandle>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(text: string) {
    setSending(true);
    try {
      setSent(await staging.resolve(text));
      staging.clear();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-2">
      <MarkdownEditor
        ref={editor}
        ariaLabel="Comment"
        placeholder="Paste or drop a screenshot, then Mod-Enter"
        className="min-h-28 max-h-72"
        staging={staging.editor}
        onSubmit={send}
      />
      <div className="flex flex-wrap items-center gap-2">
        {staging.staged.map((item) => (
          <Button
            key={item.key}
            variant="outline"
            size="sm"
            aria-label={`Remove ${item.file.name}`}
            onClick={() => staging.remove(item.key)}
            {...stagedFileDrag(item.key)}
          >
            {item.file.name}
            <XIcon data-icon="inline-end" />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => picker.current?.click()}
        >
          <PaperclipIcon data-icon="inline-start" />
          Attach files
        </Button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            staging.stage(event.target.files ?? []);
            event.target.value = "";
          }}
        />
        <Button
          className="ml-auto"
          size="sm"
          disabled={sending}
          onClick={() => void send(editor.current?.getValue() ?? "")}
        >
          {sending ? "Sending…" : "Comment"}
        </Button>
      </div>
      {sent !== null && (
        <pre className="overflow-auto rounded-frame bg-muted p-3 text-ui-sm whitespace-pre-wrap">
          {sent}
        </pre>
      )}
    </div>
  );
}
