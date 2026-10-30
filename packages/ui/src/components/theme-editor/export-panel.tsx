import { useRef } from "react";
import { copyToClipboard } from "../../lib/clipboard.ts";
import { Button } from "../button.tsx";
import { Textarea } from "../textarea.tsx";

export interface ExportPanelProps {
  title: string;
  /** The theme file, as `serializeThemeFile` writes it. */
  text: string;
  /** The download's file name. */
  fileName: string;
  onBack: () => void;
}

/** "Paper & Ink" → "paper-and-ink.orz-themes.json"; a label with nothing to slug → "custom-theme". */
export function themeFileName(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "custom-theme"}.orz-themes.json`;
}

export const ALL_THEMES_FILE_NAME = "custom-themes.orz-themes.json";

/** Shows a theme file to copy or download. */
export function ExportPanel({
  title,
  text,
  fileName,
  onBack,
}: ExportPanelProps) {
  const field = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    if (await copyToClipboard(text, "Theme file copied")) return;
    // Selected, Ctrl+C still works where the clipboard API is blocked.
    field.current?.focus();
    field.current?.select();
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    // Revoked a tick later: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-ui font-medium">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back to the theme
        </Button>
      </div>
      <Textarea
        ref={field}
        aria-label="Theme file"
        readOnly
        spellCheck={false}
        className="field-sizing-fixed h-80 resize-y font-mono text-ui-sm md:text-ui-sm"
        value={text}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          Copy
        </Button>
        <Button type="button" size="sm" onClick={download}>
          Download .json
        </Button>
      </div>
    </div>
  );
}
