import { LoadFailure } from "@orz/ui/components/load-failure";
import { cn } from "@orz/ui/lib/utils";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadPostalMime } from "./load-postal-mime.ts";
import { MailView } from "./mail-view.tsx";
import { type MailData, parseMail } from "./parse.ts";

export type MailRaw = ArrayBuffer | Uint8Array | string;

type Settled =
  | { status: "ready"; mail: MailData }
  | { status: "error"; error: Error }
  | { status: "unavailable"; error: Error };

/** postal-mime could not be fetched. */
type Unavailable = {
  status: "unavailable";
  error: Error;
  /** Fetches it again. */
  retry: () => void;
  /** Whether a retry is under way. */
  retrying: boolean;
};

type Parsed =
  | { status: "reading" }
  | Exclude<Settled, { status: "unavailable" }>
  | Unavailable;

const asError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

/** The parse of `raw`, dropped when `raw` changes or the caller unmounts before it settles. */
export function useParsedMail(raw: MailRaw): Parsed {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    raw: MailRaw;
    attempt: number;
    result: Settled;
  }>();
  useEffect(() => {
    let current = true;
    const settle = (result: Settled) => {
      if (current) setSettled({ raw, attempt, result });
    };
    // Loaded on its own first, so a chunk that did not arrive is told apart
    // from a message that does not parse, which reading again cannot mend.
    loadPostalMime().then(
      () =>
        parseMail(raw).then(
          (mail) => settle({ status: "ready", mail }),
          (error: unknown) =>
            settle({ status: "error", error: asError(error) }),
        ),
      (error: unknown) =>
        settle({ status: "unavailable", error: asError(error) }),
    );
    return () => {
      current = false;
    };
  }, [raw, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return useMemo((): Parsed => {
    if (settled?.raw !== raw) return { status: "reading" };
    const { result } = settled;
    if (settled.attempt !== attempt) {
      // The failure stays, its Retry disabled, until the next attempt settles.
      return result.status === "unavailable"
        ? { ...result, retry, retrying: true }
        : { status: "reading" };
    }
    return result.status === "unavailable"
      ? { ...result, retry, retrying: false }
      : result;
  }, [settled, raw, attempt, retry]);
}

export function MailReading({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-ui", className)}>
      Reading message…
    </p>
  );
}

export function MailError({
  error,
  className,
  children,
}: {
  error: Error;
  className?: string;
  /** What the reader can do instead, such as a download link. */
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1 text-ui", className)}>
      <p className="font-medium">Couldn't read this message.</p>
      <p className="text-muted-foreground">{error.message}</p>
      {children}
    </div>
  );
}

/** postal-mime did not arrive: what failed, the browser's words for it, and Retry. */
export function MailUnavailable({
  parsed,
  className,
}: {
  parsed: Unavailable;
  className?: string;
}) {
  return (
    <LoadFailure
      orientation="vertical"
      message="Couldn't load the mail reader."
      detail={parsed.error.message}
      onRetry={parsed.retry}
      retrying={parsed.retrying}
      className={className}
    />
  );
}

export type MailMessageProps = {
  /** The message as sent. Bytes decode each part in its own charset; a string may garble an 8bit body. */
  raw: MailRaw;
  className?: string;
};

/**
 * A mail message (an `.eml`): its subject, sender, date and recipients, the body as plain text or
 * HTML, and its attachments, which open in a viewer of their own over the message. The HTML runs no
 * script and loads nothing remote.
 */
export function MailMessage({ raw, className }: MailMessageProps) {
  const parsed = useParsedMail(raw);
  if (parsed.status === "reading") return <MailReading className={className} />;
  if (parsed.status === "unavailable") {
    return <MailUnavailable parsed={parsed} className={className} />;
  }
  if (parsed.status === "error") {
    return <MailError error={parsed.error} className={className} />;
  }
  return <MailView mail={parsed.mail} className={className} />;
}
