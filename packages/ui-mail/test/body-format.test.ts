import { describe, expect, it } from "vitest";
import { isFlowedBody } from "../src/body-format.ts";

const mail = (...lines: string[]) => lines.join("\r\n");

describe("isFlowedBody", () => {
  it("reads a top-level flowed text/plain", () => {
    expect(
      isFlowedBody(
        mail("Subject: hi", "Content-Type: text/plain; format=flowed", "", "x"),
      ),
    ).toBe(true);
  });

  it("is false without a format parameter, or without a Content-Type", () => {
    expect(
      isFlowedBody(
        mail("Content-Type: text/plain; charset=utf-8", "", "hello"),
      ),
    ).toBe(false);
    expect(isFlowedBody(mail("Subject: hi", "", "hello"))).toBe(false);
  });

  it("finds the body text inside nested multiparts", () => {
    const raw = mail(
      'Content-Type: multipart/mixed; boundary="outer"',
      "",
      "--outer",
      "Content-Type: multipart/alternative; boundary=inner",
      "",
      "--inner",
      "Content-Type: text/plain; charset=utf-8; format=flowed",
      "",
      "flowed text ",
      "--inner",
      "Content-Type: text/html",
      "",
      "<p>html</p>",
      "--inner--",
      "--outer",
      "Content-Type: application/octet-stream",
      "",
      "AAAA",
      "--outer--",
    );
    expect(isFlowedBody(raw)).toBe(true);
    expect(isFlowedBody(new TextEncoder().encode(raw))).toBe(true);
    expect(isFlowedBody(new TextEncoder().encode(raw).buffer)).toBe(true);
  });

  it("skips a flowed text/plain attachment", () => {
    const raw = mail(
      "Content-Type: multipart/mixed; boundary=b",
      "",
      "--b",
      "Content-Type: text/plain; format=flowed",
      "Content-Disposition: attachment; filename=notes.txt",
      "",
      "notes",
      "--b",
      "Content-Type: text/plain",
      "",
      "body",
      "--b--",
    );
    expect(isFlowedBody(raw)).toBe(false);
  });

  it("unfolds a folded Content-Type and reads quoted, spaced parameters", () => {
    expect(
      isFlowedBody(
        mail(
          "Content-Type: text/plain;",
          '\tcharset="utf-8";',
          ' format = "flowed"',
          "",
          "x",
        ),
      ),
    ).toBe(true);
    const raw = mail(
      'Content-Type: multipart/mixed; boundary="a b;c"',
      "",
      "--a b;c   ",
      "Content-Type: text/plain; format=flowed",
      "",
      "x",
      "--a b;c--",
    );
    expect(isFlowedBody(raw)).toBe(true);
  });

  it("gives up past the nesting limit", () => {
    let raw = mail("Content-Type: text/plain; format=flowed", "", "x");
    for (let i = 0; i < 300; i++) {
      raw = mail(
        `Content-Type: multipart/mixed; boundary=b${i}`,
        "",
        `--b${i}`,
        raw,
        `--b${i}--`,
      );
    }
    expect(isFlowedBody(raw)).toBe(false);
  });
});
