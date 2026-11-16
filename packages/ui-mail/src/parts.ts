import type { AttachmentItem } from "@orz/ui-content/attachment";
import { useEffect, useState } from "react";
import type { MailPart } from "./parse.ts";

/** UTF-8 when the bytes are valid UTF-8, else windows-1252, as postal-mime reads a body. */
function decodeText(content: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return new TextDecoder("windows-1252").decode(content);
  }
}

/**
 * The parts as files a viewer can open, each at a blob URL made for it. Null until the URLs
 * exist, since a renderer refuses a file without one; they are revoked when the parts change or
 * the caller unmounts.
 */
export function useMailFiles(parts: MailPart[]): AttachmentItem[] | null {
  const [files, setFiles] = useState<{
    parts: MailPart[];
    items: AttachmentItem[];
  } | null>(null);
  useEffect(() => {
    const items = parts.map(
      (part, index): AttachmentItem => ({
        kind: "file",
        key: index,
        name: part.name,
        mime: part.mime,
        size: part.size,
        url: URL.createObjectURL(new Blob([part.content], { type: part.mime })),
        load: async () => decodeText(part.content),
      }),
    );
    setFiles({ parts, items });
    return () => {
      for (const item of items) {
        if (item.url !== undefined) URL.revokeObjectURL(item.url);
      }
    };
  }, [parts]);
  // URLs made for an earlier message are already revoked.
  return files?.parts === parts ? files.items : null;
}
