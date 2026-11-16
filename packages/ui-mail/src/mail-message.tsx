import { cn } from "@orz/ui/lib/utils";
import { type ReactNode, useEffect, useState } from "react";
import { MailView } from "./mail-view.tsx";
import { type MailData, parseMail } from "./parse.ts";

export type MailRaw = ArrayBuffer | Uint8Array | string;

type Parsed =
  | { status: "reading" }
  | { status: "ready"; mail: MailData }
  | { status: "error"; error: Error };

/** The parse of `raw`, dropped when `raw` changes or the caller unmounts before it settles. */
export function useParsedMail(raw: MailRaw): Parsed {
  const [parsed, setParsed] = useState<{ raw: MailRaw; parsed: Parsed }>();
  useEffect(() => {
    let current = true;
    parseMail(raw).then(
      (mail) => {
        if (current) setParsed({ raw, parsed: { status: "ready", mail } });
      },
      (error: unknown) => {
        if (current) {
          setParsed({
            raw,
            parsed: {
              status: "error",
              error: error instanceof Error ? error : new Error(String(error)),
            },
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [raw]);
  return parsed?.raw === raw ? parsed.parsed : { status: "reading" };
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
  if (parsed.status === "error") {
    return <MailError error={parsed.error} className={className} />;
  }
  return <MailView mail={parsed.mail} className={className} />;
}
