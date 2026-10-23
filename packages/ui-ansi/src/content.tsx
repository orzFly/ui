import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import { AnsiView } from "./view/ansi-view.tsx";

/**
 * The largest file `ansiContent` or `logContent` previews. The view is virtualised, so the cap is
 * set by the memory a parsed log takes rather than by layout, and sits far above
 * `TEXT_PREVIEW_MAX_BYTES`.
 */
export const ANSI_PREVIEW_MAX_BYTES = 64 * 1024 * 1024;

type FileSource = Extract<ContentSource, { kind: "file" }>;

const DOCUMENT_MAX_HEIGHT = "32rem";

function isAnsi(source: ContentSource): boolean {
  if (source.kind === "inline") return source.lang?.toLowerCase() === "ansi";
  if (/\.ansi$/i.test(source.name)) return true;
  const mime = source.mime?.split(";")[0]?.trim().toLowerCase();
  return mime === "text/x-ansi";
}

function isLog(source: ContentSource): boolean {
  if (source.kind === "inline") return source.lang?.toLowerCase() === "log";
  if (/\.log$/i.test(source.name)) return true;
  const mime = source.mime?.split(";")[0]?.trim().toLowerCase();
  return mime === "text/x-log";
}

function TooLargeFile({
  source,
  placement,
  className,
}: ContentProps & { source: FileSource }) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>Too large to preview — download to view.</span>
    </div>
  );
}

interface FileProps extends ContentProps {
  source: FileSource;
  levels: boolean;
}

function LoadedFile({ source, placement, className, levels }: FileProps) {
  const text = useSourceText(source);
  if (text.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (text.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{text.error.message}</span>{" "}
        <Button size="xs" variant="outline" onClick={text.retry}>
          Retry
        </Button>
      </div>
    );
  }
  // Counted in UTF-16 units, not bytes: the cap is generous, and encoding a
  // 64 MiB string only to measure it would cost more than the check saves.
  if (text.text.length > ANSI_PREVIEW_MAX_BYTES) {
    return (
      <TooLargeFile
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  return (
    <AnsiView
      chrome="file"
      levels={levels}
      filename={source.name}
      downloadUrl={source.url}
      // The final newline would otherwise end the file on an empty numbered line.
      text={text.text.replace(/\r?\n$/, "")}
      maxHeight={placement === "document" ? DOCUMENT_MAX_HEIGHT : undefined}
      className={cn(
        placement === "viewer" && "h-(--attachment-pane-height)",
        className,
      )}
    />
  );
}

function AnsiFile(props: FileProps) {
  const { source, placement, className } = props;
  if (source.size !== undefined && source.size > ANSI_PREVIEW_MAX_BYTES) {
    return (
      <TooLargeFile
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  return <LoadedFile {...props} />;
}

function Source({
  source,
  placement,
  className,
  levels,
}: ContentProps & { levels: boolean }) {
  if (source.kind === "file") {
    return (
      <AnsiFile
        source={source}
        placement={placement}
        className={className}
        levels={levels}
      />
    );
  }
  return (
    <AnsiView
      chrome="pane"
      levels={levels}
      text={source.text}
      className={className}
      maxHeight={placement === "document" ? DOCUMENT_MAX_HEIGHT : undefined}
    />
  );
}

function Ansi(props: ContentProps) {
  return <Source {...props} levels={false} />;
}

function Log(props: ContentProps) {
  return <Source {...props} levels />;
}

/**
 * The registry entry for terminal output: a source tagged `ansi` (a fenced block) and a `.ansi` or
 * `text/x-ansi` file, in either placement. Register it before any renderer that takes every inline
 * source, such as `codeContent`. A file over `ANSI_PREVIEW_MAX_BYTES` gets the download link.
 */
export const ansiContent: ContentRenderer = {
  name: "ansi",
  accepts: isAnsi,
  display: "block",
  Component: Ansi,
};

/**
 * The registry entry for logs: a source tagged `log` and a `.log` or `text/x-log` file, drawn with
 * level chips, the level filter and search. Register it before `codeContent`, which claims the same
 * sources and stops at a far smaller size. Files share `ansiContent`'s cap.
 */
export const logContent: ContentRenderer = {
  name: "log",
  accepts: isLog,
  display: "block",
  Component: Log,
};
