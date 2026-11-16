import { describe, expect, it } from "vitest";
import { parseMail } from "../src/parse.ts";

const mail = (...lines: string[]) => lines.join("\r\n");

const latin1 = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

const SERIES = mail(
  "From: =?UTF-8?Q?Al=C3=AFce?= <noreply@example.com>",
  "To: dev@lists.example.com, bot-one <bot-one@example.com>",
  "Cc: newcomer <newcomer@example.com>",
  "Reply-To: dev@lists.example.com",
  "Subject: =?UTF-8?B?W1BBVENIIDAvMl0gUmV0cnkg4oCU?= once",
  "Date: Tue, 20 Oct 2026 16:04:00 +0000",
  "Message-ID: <cover.1@example.com>",
  "In-Reply-To: <earlier@example.com>",
  "References: <earlier@example.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="mixed"',
  "",
  "--mixed",
  'Content-Type: multipart/alternative; boundary="alt"',
  "",
  "--alt",
  "Content-Type: text/plain; charset=utf-8; format=flowed",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Caf=C3=A9=20",
  "au lait",
  "--alt",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Caf&eacute;</p>",
  "--alt--",
  "--mixed",
  "Content-Type: application/octet-stream; name=0001-fix.patch",
  "Content-Disposition: attachment; filename=0001-fix.patch",
  "Content-Transfer-Encoding: base64",
  "",
  btoa("diff --git a/x b/x\n"),
  "--mixed",
  'Content-Type: image/png; name="../../etc/\u202egnp.exe"',
  'Content-Disposition: attachment; filename="../../etc/\u202egnp\x07.exe"',
  "Content-ID: <shot@example.com>",
  "Content-Transfer-Encoding: base64",
  "",
  "iVBORw0KGgo=",
  "--mixed",
  "Content-Type: image/png",
  "Content-Disposition: attachment",
  "Content-Transfer-Encoding: base64",
  "",
  "iVBORw0KGgo=",
  "--mixed--",
);

describe("parseMail", () => {
  it("decodes encoded words in the subject and names", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.subject).toBe("[PATCH 0/2] Retry — once");
    expect(parsed.from).toEqual({
      name: "Alïce",
      address: "noreply@example.com",
    });
  });

  it("reads the recipients and the threading headers", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.to.map((a) => a.address)).toEqual([
      "dev@lists.example.com",
      "bot-one@example.com",
    ]);
    expect(parsed.cc).toEqual([
      { name: "newcomer", address: "newcomer@example.com" },
    ]);
    expect(parsed.replyTo.map((a) => a.address)).toEqual([
      "dev@lists.example.com",
    ]);
    expect(parsed.messageId).toBe("<cover.1@example.com>");
    expect(parsed.inReplyTo).toBe("<earlier@example.com>");
    expect(parsed.references).toBe("<earlier@example.com>");
    expect(parsed.date).toBe("2026-10-20T16:04:00.000Z");
    expect(parsed.dateHeader).toBe("Tue, 20 Oct 2026 16:04:00 +0000");
  });

  it("decodes quoted-printable text, joins flowed lines and keeps the HTML", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.text?.trim()).toBe("Café au lait");
    expect(parsed.flowed).toBe(true);
    expect(parsed.html).toContain("<p>Caf&eacute;</p>");
  });

  it("decodes base64 parts into bytes, in order", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.parts.map((p) => p.mime)).toEqual([
      "application/octet-stream",
      "image/png",
      "image/png",
    ]);
    const patch = parsed.parts[0];
    expect(patch?.name).toBe("0001-fix.patch");
    expect(new TextDecoder().decode(patch?.content)).toBe(
      "diff --git a/x b/x\n",
    );
    expect(patch?.size).toBe(19);
  });

  it("strips path separators, control characters and direction overrides from file names", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.parts[1]?.name).toBe("....etcgnp.exe");
  });

  it("names a part that names none after its place and type", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.parts[2]?.name).toBe("part-3.png");
  });

  it("takes the angle brackets off a Content-ID", async () => {
    const parsed = await parseMail(SERIES);
    expect(parsed.parts[1]?.contentId).toBe("shot@example.com");
    expect(parsed.parts[0]?.contentId).toBeUndefined();
  });

  it("reads an 8bit iso-8859-1 body from its bytes", async () => {
    const parsed = await parseMail(
      latin1(
        mail(
          "From: alice <noreply@example.com>",
          "Subject: =?iso-8859-1?Q?R=E9sum=E9?=",
          "Content-Type: text/plain; charset=iso-8859-1",
          "Content-Transfer-Encoding: 8bit",
          "",
          "D\xE9j\xE0 vu, na\xEFve",
        ),
      ),
    );
    expect(parsed.subject).toBe("Résumé");
    expect(parsed.text?.trim()).toBe("Déjà vu, naïve");
    expect(parsed.flowed).toBe(false);
  });

  it("gives a group's members", async () => {
    const parsed = await parseMail(
      mail(
        "From: noreply@example.com",
        "To: Team: alice <alice@example.com>, bot-one@example.com;",
        "",
        "hi",
      ),
    );
    expect(parsed.to.map((a) => a.address)).toEqual([
      "alice@example.com",
      "bot-one@example.com",
    ]);
  });

  it("leaves out what the message does not have", async () => {
    const parsed = await parseMail(
      mail("From: noreply@example.com", "Date: someday", "", "hi"),
    );
    expect(parsed.subject).toBe("");
    expect(parsed.date).toBeUndefined();
    expect(parsed.dateHeader).toBe("someday");
    expect(parsed.to).toEqual([]);
    expect(parsed.html).toBeUndefined();
    expect(parsed.parts).toEqual([]);
  });

  it("rejects text that is not a message", async () => {
    await expect(parseMail("just some text\nwith lines\n")).rejects.toThrow(
      "No mail headers found.",
    );
    await expect(parseMail("")).rejects.toThrow();
  });

  it("rejects a message past the nesting limit", async () => {
    let raw = mail("Content-Type: text/plain", "", "x");
    for (let i = 0; i < 300; i++) {
      raw = mail(
        `Content-Type: multipart/mixed; boundary=b${i}`,
        "",
        `--b${i}`,
        raw,
        `--b${i}--`,
      );
    }
    await expect(parseMail(raw)).rejects.toThrow(/nesting/);
  });
});
