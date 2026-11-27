import type { Address } from "postal-mime";
import { isFlowedBody } from "./body-format.ts";
import { loadPostalMime } from "./load-postal-mime.ts";

export type MailAddress = { name: string; address: string };

/** One attachment or inline part, in the order the message carries it. */
export type MailPart = {
  /**
   * The part's file name, made safe to show and to save under: no path separators, control
   * characters or bidirectional overrides. `part-<n>` when the part names none.
   */
  name: string;
  mime: string;
  size: number;
  content: ArrayBuffer;
  /** The Content-ID, without its angle brackets. */
  contentId?: string;
  /** A part the HTML body refers to by its Content-ID: an inline image. */
  related: boolean;
};

export type MailData = {
  /** Decoded; "" when the message has none. */
  subject: string;
  from?: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  replyTo: MailAddress[];
  /** ISO 8601; undefined when the Date header does not parse. */
  date?: string;
  /** The Date header as written. */
  dateHeader?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  /** The plain body, with flowed lines already joined. */
  text?: string;
  /** Whether the plain body was sent as `format=flowed`, so may wrap. */
  flowed: boolean;
  html?: string;
  parts: MailPart[];
};

/** Groups give their members: a reader wants the people, not the list's label. */
function mailboxes(addresses: Address[] | Address | undefined): MailAddress[] {
  if (addresses === undefined) return [];
  return (Array.isArray(addresses) ? addresses : [addresses]).flatMap(
    (entry) =>
      entry.group !== undefined
        ? entry.group.map(({ name, address }) => ({ name, address }))
        : [{ name: entry.name, address: entry.address }],
  );
}

const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/x-patch": ".patch",
  "text/x-diff": ".diff",
  "message/rfc822": ".eml",
  "application/pdf": ".pdf",
};

// Path separators would let a saved file climb out of its folder, control
// characters break the line it is shown on, and the bidirectional overrides
// and isolates (U+202A–U+202E, U+2066–U+2069) let `exe.png` read as `gnp.exe`.
// biome-ignore lint/suspicious/noControlCharactersInRegex: they are what it removes
const UNSAFE = /[/\\\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

/** The sender wrote the name: keep what it says, drop what it could do. */
export function safeFileName(
  name: string | null,
  mime: string,
  index: number,
): string {
  const cleaned = (name ?? "").replace(UNSAFE, "").trim();
  if (cleaned !== "" && cleaned !== "." && cleaned !== "..") return cleaned;
  return `part-${index + 1}${EXTENSIONS[mime] ?? ""}`;
}

function toArrayBuffer(content: ArrayBuffer | Uint8Array | string) {
  if (content instanceof ArrayBuffer) return content;
  if (typeof content === "string") {
    return new TextEncoder().encode(content).buffer as ArrayBuffer;
  }
  return content.slice().buffer as ArrayBuffer;
}

/**
 * Reads a raw message (RFC 5322, with its MIME parts). Bytes decode each part in its own charset;
 * a string has already been decoded once, so an 8bit body in a charset other than UTF-8 may come
 * out garbled. Rejects input with no headers at all, and a message past postal-mime's limits on
 * nesting, parts or header size. The first call fetches postal-mime, which the app's bundler
 * splits into a chunk of its own; it rejects too when that fetch fails, and the next call
 * fetches it again.
 */
export async function parseMail(
  raw: ArrayBuffer | Uint8Array | string,
): Promise<MailData> {
  const { default: PostalMime } = await loadPostalMime();
  const email = await PostalMime.parse(raw, {
    attachmentEncoding: "arraybuffer",
  });
  if (email.headers.length === 0) {
    throw new Error("No mail headers found.");
  }
  const dateHeader = email.headers.find((h) => h.key === "date")?.value;
  const time = email.date === undefined ? Number.NaN : Date.parse(email.date);
  return {
    subject: email.subject ?? "",
    from: mailboxes(email.from)[0],
    to: mailboxes(email.to),
    cc: mailboxes(email.cc),
    replyTo: mailboxes(email.replyTo),
    date: Number.isNaN(time) ? undefined : new Date(time).toISOString(),
    dateHeader,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    references: email.references,
    text: email.text,
    flowed: isFlowedBody(raw),
    html: email.html,
    parts: email.attachments.map((part, index) => {
      const content = toArrayBuffer(part.content);
      const contentId = part.contentId?.trim().replace(/^<|>$/g, "");
      return {
        name: safeFileName(part.filename, part.mimeType, index),
        mime: part.mimeType,
        size: content.byteLength,
        content,
        contentId: contentId === "" ? undefined : contentId,
        related: part.related === true,
      };
    }),
  };
}
