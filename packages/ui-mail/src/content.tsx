import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isMailFile,
  useContentTitleBar,
} from "@orz/ui-content";
import { useEffect, useRef, useState } from "react";
import {
  MailError,
  type MailRaw,
  MailReading,
  useParsedMail,
} from "./mail-message.tsx";
import { MailView } from "./mail-view.tsx";

/**
 * The largest message `emlContent` reads; past it the viewer offers the download. Measured in
 * headless Chromium on a message that is one base64 attachment: parsing 8 MiB blocked the tab for
 * 0.2 s in its longest task, 16 MiB for 0.3 s, 32 MiB for 0.6 s, well under the 1.5 s that
 * `TEXT_PREVIEW_HARD_MAX_BYTES` allows.
 */
export const MAIL_PREVIEW_MAX_BYTES = 32 * 1024 * 1024;

type FileSource = Extract<ContentSource, { kind: "file" }>;

type Raw =
  | { status: "loading" }
  | { status: "ready"; raw: MailRaw }
  | { status: "too-large" }
  | { status: "error"; error: Error };

/**
 * The file's bytes from its `url`, which keep an 8bit body in its own charset; else the text
 * `load` gives.
 */
function useMailRaw(source: FileSource, attempt: number): Raw {
  const [raw, setRaw] = useState<{ key: string; raw: Raw }>();
  const { url } = source;
  // Read once per url and attempt: an app that builds a fresh `load` each
  // render must not restart the read.
  const latestLoad = useRef(source.load);
  latestLoad.current = source.load;
  const key = `${attempt}:${url ?? ""}`;
  useEffect(() => {
    const controller = new AbortController();
    const settle = (next: Raw) => {
      if (!controller.signal.aborted) setRaw({ key, raw: next });
    };
    const fetched: Promise<MailRaw> =
      url !== undefined
        ? fetch(url, { signal: controller.signal }).then((response) => {
            if (!response.ok) {
              throw new Error(
                `${response.status} ${response.statusText}`.trim(),
              );
            }
            return response.arrayBuffer();
          })
        : (latestLoad.current as (signal: AbortSignal) => Promise<string>)(
            controller.signal,
          );
    fetched
      .then((value) => {
        const size =
          typeof value === "string" ? value.length : value.byteLength;
        settle(
          size > MAIL_PREVIEW_MAX_BYTES
            ? { status: "too-large" }
            : { status: "ready", raw: value },
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
  return raw?.key === key ? raw.raw : { status: "loading" };
}

function TooLarge({ source, placement, className }: ContentProps) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>Too large to preview — download to view.</span>
    </div>
  );
}

function ParsedMail({
  source,
  raw,
  placement,
}: {
  source: FileSource;
  raw: MailRaw;
  placement: ContentProps["placement"];
}) {
  const parsed = useParsedMail(raw);
  const controlsTarget = useContentTitleBar(source);
  if (parsed.status === "reading") return <MailReading />;
  if (parsed.status === "error") {
    return (
      <MailError error={parsed.error}>
        <ContentFallback source={source} placement={placement} />
      </MailError>
    );
  }
  return <MailView mail={parsed.mail} controlsTarget={controlsTarget} />;
}

function LoadedMail({
  source,
  placement,
  className,
}: ContentProps & { source: FileSource }) {
  const [attempt, setAttempt] = useState(0);
  const raw = useMailRaw(source, attempt);
  if (raw.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (raw.status === "too-large") {
    return (
      <TooLarge source={source} placement={placement} className={className} />
    );
  }
  if (raw.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{raw.error.message}</span>{" "}
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
  // As tall as the viewer's pane, scrolling inside it, like the other
  // viewer renderers. Inline, as the pane's height is the viewer's variable.
  return (
    <div
      className={cn("overflow-y-auto", className)}
      style={{ height: "var(--attachment-pane-height)" }}
    >
      <ParsedMail source={source} raw={raw.raw} placement={placement} />
    </div>
  );
}

function Eml(props: ContentProps) {
  const { source, placement, className } = props;
  if (source.kind !== "file") return null;
  if (source.size !== undefined && source.size > MAIL_PREVIEW_MAX_BYTES) {
    return (
      <TooLarge source={source} placement={placement} className={className} />
    );
  }
  return <LoadedMail {...props} source={source} />;
}

/**
 * The registry entry for mail messages (`.eml`, `message/rfc822`), drawn as `MailMessage` in the
 * viewer only, with its plain/HTML switch in the viewer's title bar. Register it before
 * `hexContent`, which takes every file that is not text. Give the file a `url` where you can: its
 * bytes keep an 8bit body in its own charset, which the text from `load` may have lost.
 */
export const emlContent: ContentRenderer = {
  name: "eml",
  accepts: (source, placement) =>
    placement === "viewer" &&
    source.kind === "file" &&
    !source.deleted &&
    isMailFile(source) &&
    (source.url !== undefined || source.load !== undefined),
  display: "block",
  Component: Eml,
};
