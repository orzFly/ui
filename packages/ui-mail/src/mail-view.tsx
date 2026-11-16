import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { cn } from "@orz/ui/lib/utils";
import {
  AttachmentList,
  AttachmentViewerProvider,
} from "@orz/ui-content/attachment";
import { type ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { prepareHtml } from "./html.ts";
import { HtmlBody, PlainBody } from "./mail-body.tsx";
import { MailHeader } from "./mail-header.tsx";
import type { MailData } from "./parse.ts";
import { useMailFiles } from "./parts.ts";

type Format = "text" | "html";

/**
 * A parsed message: header, body and attachments. The plain/HTML switch goes into
 * `controlsTarget` when there is one, waits while it is null (a title bar still mounting), and
 * sits above the body when it is undefined.
 */
export function MailView({
  mail,
  controlsTarget,
  className,
}: {
  mail: MailData;
  controlsTarget?: HTMLElement | null;
  className?: string;
}) {
  const hasText = mail.text !== undefined && mail.text.trim() !== "";
  const hasHtml = mail.html !== undefined && mail.html.trim() !== "";
  const [chosen, setChosen] = useState<Format>("text");
  const format: Format =
    hasText && hasHtml ? chosen : hasHtml ? "html" : "text";
  const files = useMailFiles(mail.parts);

  const html = useMemo(() => {
    if (!hasHtml || files === null) return null;
    const cidUrls = new Map<string, string>();
    mail.parts.forEach((part, i) => {
      const url = files[i]?.url;
      if (part.contentId !== undefined && url !== undefined) {
        cidUrls.set(part.contentId, url);
      }
    });
    return prepareHtml(mail.html ?? "", cidUrls);
  }, [hasHtml, mail, files]);

  // An image the HTML body already shows is not an attachment to the reader
  // of that body; under the plain one it is the only place it appears.
  const listed =
    files === null
      ? []
      : format === "html"
        ? files.filter((_, i) => !mail.parts[i]?.related)
        : files;

  const formatSwitch = hasText && hasHtml && (
    <SegmentedControl
      aria-label="Message format"
      value={format}
      onValueChange={(value) => setChosen(value as Format)}
    >
      <SegmentedControlItem value="text">Plain text</SegmentedControlItem>
      <SegmentedControlItem value="html">HTML</SegmentedControlItem>
    </SegmentedControl>
  );

  let body: ReactNode;
  if (format === "html" && hasHtml) {
    body = html === null ? null : <HtmlBody {...html} />;
  } else if (hasText) {
    body = <PlainBody text={mail.text ?? ""} flowed={mail.flowed} />;
  } else {
    body = (
      <p className="text-muted-foreground text-ui">This message has no text.</p>
    );
  }

  return (
    // Its own viewer: an attachment opens over the message, and closing it
    // comes back here, even when the message is itself open in a viewer.
    <AttachmentViewerProvider>
      <article className={cn("flex min-w-0 flex-col gap-4", className)}>
        <MailHeader mail={mail} />
        {formatSwitch &&
          (controlsTarget === undefined ? (
            <div className="-mb-2 flex justify-end">{formatSwitch}</div>
          ) : (
            controlsTarget !== null &&
            createPortal(formatSwitch, controlsTarget)
          ))}
        {body}
        {listed.length > 0 && (
          <AttachmentList items={listed} fold={false} thumbnails />
        )}
      </article>
    </AttachmentViewerProvider>
  );
}
