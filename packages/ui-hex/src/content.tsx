import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isTextFile,
} from "@orz/ui-content";
import { useEffect, useState } from "react";
import { HexView } from "./hex-view.tsx";
import { type ByteSource, blobSource } from "./source.ts";

/**
 * The largest file `hexContent` previews. The view pages through a `Blob`, so the cap is the
 * download held in memory, not layout.
 */
export const HEX_PREVIEW_MAX_BYTES = 64 * 1024 * 1024;

type FileSource = Extract<ContentSource, { kind: "file" }>;

type Bytes =
  | { status: "loading" }
  | { status: "ready"; source: ByteSource }
  | { status: "too-large" }
  | { status: "error"; error: Error };

function useFileBytes(url: string, attempt: number): Bytes {
  const [bytes, setBytes] = useState<{ key: string; bytes: Bytes }>();
  const key = `${attempt}:${url}`;
  useEffect(() => {
    const controller = new AbortController();
    const settle = (next: Bytes) => {
      if (!controller.signal.aborted) setBytes({ key, bytes: next });
    };
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`.trim());
        }
        const blob = await response.blob();
        settle(
          blob.size > HEX_PREVIEW_MAX_BYTES
            ? { status: "too-large" }
            : { status: "ready", source: blobSource(blob) },
        );
      })
      .catch((error: unknown) =>
        settle({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
    return () => controller.abort();
  }, [url, key]);
  // A result for an earlier url or attempt is stale: show loading until this one settles.
  return bytes?.key === key ? bytes.bytes : { status: "loading" };
}

function TooLarge({ source, placement, className }: ContentProps) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>Too large to preview — download to view.</span>
    </div>
  );
}

function LoadedHex({
  source,
  url,
  placement,
  className,
}: ContentProps & { source: FileSource; url: string }) {
  const [attempt, setAttempt] = useState(0);
  const bytes = useFileBytes(url, attempt);
  if (bytes.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (bytes.status === "too-large") {
    return (
      <TooLarge source={source} placement={placement} className={className} />
    );
  }
  if (bytes.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{bytes.error.message}</span>{" "}
        <Button
          size="xs"
          variant="outline"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry
        </Button>
      </div>
    );
  }
  // The view fills its parent; the viewer sets the pane's height. Inline, so
  // the package needs no Tailwind source scanning for one class.
  return (
    <div
      className={className}
      style={{ height: "var(--attachment-pane-height)" }}
    >
      <HexView source={bytes.source} columns="auto" aria-label={source.name} />
    </div>
  );
}

function Hex(props: ContentProps) {
  const { source, placement, className } = props;
  if (source.kind !== "file" || source.url === undefined) return null;
  if (source.size !== undefined && source.size > HEX_PREVIEW_MAX_BYTES) {
    return (
      <TooLarge source={source} placement={placement} className={className} />
    );
  }
  return <LoadedHex {...props} source={source} url={source.url} />;
}

/**
 * The registry entry for binary files: any file with a `url` that is not text, drawn as a hex
 * dump, in the viewer only. Register it last: it takes every binary file the renderers before it
 * pass on, so a viewer that has it previews a `.bin` or a `.zip` instead of offering a download.
 * A file over `HEX_PREVIEW_MAX_BYTES` gets the download link.
 */
export const hexContent: ContentRenderer = {
  name: "hex",
  accepts: (source, placement) =>
    placement === "viewer" &&
    source.kind === "file" &&
    source.url !== undefined &&
    !source.deleted &&
    !isTextFile(source),
  display: "block",
  Component: Hex,
};
