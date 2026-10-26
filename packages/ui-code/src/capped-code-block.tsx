import { TEXT_PREVIEW_MAX_BYTES } from "@orz/ui-content";
import { useMemo } from "react";
import { CodeBlock } from "./code-block.tsx";

/**
 * Whether `text` takes more than `max` bytes as UTF-8, counted without encoding it, and stopping
 * as soon as it is over.
 */
export function exceedsBytes(text: string, max: number): boolean {
  // Every UTF-16 unit is at least one byte and at most three.
  if (text.length > max) return true;
  if (text.length * 3 <= max) return false;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    // A surrogate is half of a four-byte character.
    bytes +=
      unit < 0x80
        ? 1
        : unit < 0x800 || (unit >= 0xd800 && unit < 0xe000)
          ? 2
          : 3;
    if (bytes > max) return true;
  }
  return false;
}

/**
 * Highlights `contents` when it is within the cap, and draws it as plain text otherwise: pierre
 * over a multi-megabyte text would freeze the tab (T-31), where plain text costs next to nothing.
 * Plain text is still a virtualized code view, so it needs `capClassName` to bound its height:
 * laying out every line of a large file is a cost of its own.
 */
export function CappedCodeBlock({
  filename,
  contents,
  lineNumbers,
  capClassName,
}: {
  filename: string;
  contents: string;
  lineNumbers?: boolean;
  /** The box a text over the cap is drawn in; a height cap with its own overflow. */
  capClassName?: string;
}) {
  const tooLarge = useMemo(
    () => exceedsBytes(contents, TEXT_PREVIEW_MAX_BYTES),
    [contents],
  );
  return (
    <CodeBlock
      filename={filename}
      contents={contents}
      lineNumbers={lineNumbers}
      plain={tooLarge}
      className={tooLarge ? capClassName : undefined}
    />
  );
}
