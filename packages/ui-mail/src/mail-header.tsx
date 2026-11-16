import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Fragment, type ReactNode, useId, useState } from "react";
import type { MailAddress, MailData } from "./parse.ts";

/** Recipients the summary line names before it counts the rest. */
const SUMMARY_NAMES = 3;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function shortName({ name, address }: MailAddress): string {
  return name || address;
}

function fullName({ name, address }: MailAddress): string {
  return name ? `${name} <${address}>` : address;
}

function initial(address: MailAddress): string {
  return (shortName(address).trim()[0] ?? "?").toUpperCase();
}

/** "to a, b, cc c and 2 more": the first few names across To and Cc. */
function recipientSummary(mail: MailData): string | null {
  const total = mail.to.length + mail.cc.length;
  if (total === 0) return null;
  const to = mail.to.slice(0, SUMMARY_NAMES);
  const cc = mail.cc.slice(0, SUMMARY_NAMES - to.length);
  const parts: string[] = [];
  if (to.length > 0) parts.push(`to ${to.map(shortName).join(", ")}`);
  if (cc.length > 0) parts.push(`cc ${cc.map(shortName).join(", ")}`);
  const more = total - to.length - cc.length;
  return `${parts.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

function Field({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground raymond:text-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono" : "break-words"}>
        {children}
      </dd>
    </>
  );
}

function Addresses({ list }: { list: MailAddress[] }) {
  return list.map((address, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: one address may be listed twice
    <Fragment key={i}>
      {i > 0 && ", "}
      {fullName(address)}
    </Fragment>
  ));
}

/** Subject, sender, date and a summary of the recipients; Details lists every header as written. */
export function MailHeader({ mail }: { mail: MailData }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const summary = recipientSummary(mail);
  return (
    <header className="flex flex-col gap-2">
      <h2 className="text-balance font-semibold text-heading-3">
        {mail.subject || (
          <span className="text-muted-foreground">(no subject)</span>
        )}
      </h2>
      <div className="flex items-start gap-2.5">
        {mail.from !== undefined && (
          <Avatar aria-hidden>
            <AvatarFallback>{initial(mail.from)}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-baseline gap-x-2 text-ui">
            {mail.from !== undefined && (
              <span className="min-w-0 truncate">
                <span className="font-medium">
                  {mail.from.name || mail.from.address}
                </span>
                {mail.from.name && (
                  <span className="text-muted-foreground text-ui-sm">
                    {" "}
                    &lt;{mail.from.address}&gt;
                  </span>
                )}
              </span>
            )}
            {/* Under the name on a narrow screen, where both on one line
                would cut the address. */}
            {(mail.date ?? mail.dateHeader) !== undefined && (
              <span className="shrink-0 basis-full text-muted-foreground text-ui-sm tabular-nums sm:ml-auto sm:basis-auto">
                {mail.date !== undefined ? (
                  <time dateTime={mail.date} title={mail.dateHeader}>
                    {DATE_FORMAT.format(new Date(mail.date))}
                  </time>
                ) : (
                  mail.dateHeader
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-ui-sm">
            {summary !== null && (
              <span className="min-w-0 truncate">{summary}</span>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="-ml-1 shrink-0 text-muted-foreground"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((v) => !v)}
            >
              Details
              {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <dl
          id={detailsId}
          className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 rounded-frame bg-muted/40 p-3 text-ui-sm ring-1 ring-border raymond:rounded-none raymond:bg-(--window) raymond:shadow-sunken raymond:ring-0"
        >
          {mail.from !== undefined && (
            <Field label="From">{fullName(mail.from)}</Field>
          )}
          {mail.to.length > 0 && (
            <Field label="To">
              <Addresses list={mail.to} />
            </Field>
          )}
          {mail.cc.length > 0 && (
            <Field label="Cc">
              <Addresses list={mail.cc} />
            </Field>
          )}
          {mail.replyTo.length > 0 && (
            <Field label="Reply-To">
              <Addresses list={mail.replyTo} />
            </Field>
          )}
          {mail.dateHeader !== undefined && (
            <Field label="Date">{mail.dateHeader}</Field>
          )}
          {mail.messageId !== undefined && (
            <Field label="Message-ID" mono>
              {mail.messageId}
            </Field>
          )}
          {mail.inReplyTo !== undefined && (
            <Field label="In-Reply-To" mono>
              {mail.inReplyTo}
            </Field>
          )}
          {mail.references !== undefined && (
            <Field label="References" mono>
              {mail.references}
            </Field>
          )}
        </dl>
      )}
    </header>
  );
}
