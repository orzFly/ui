import { describe, expect, it } from "vitest";
import { prepareHtml } from "../src/html.ts";

const CIDS = new Map([["shot@example.com", "blob:app.example/1"]]);

const read = (srcdoc: string) =>
  new DOMParser().parseFromString(srcdoc, "text/html");

describe("prepareHtml", () => {
  it("opens the head with the charset, the content policy and the referrer policy", () => {
    const { srcdoc } = prepareHtml(
      '<html><head><link rel="stylesheet" href="x.css"></head><body>hi</body></html>',
      CIDS,
    );
    expect(srcdoc.startsWith("<!doctype html>")).toBe(true);
    const head = read(srcdoc).head;
    const [charset, policy, referrer] = [...head.children];
    expect(charset?.getAttribute("charset")).toBe("utf-8");
    expect(policy?.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(policy?.getAttribute("content")).toContain("default-src 'none'");
    expect(policy?.getAttribute("content")).toContain("img-src data: blob:");
    expect(referrer?.getAttribute("content")).toBe("no-referrer");
  });

  it("points cid: references at the parts and leaves an unknown one alone", () => {
    const { srcdoc } = prepareHtml(
      '<img src="cid:shot@example.com"><img src="cid:gone@example.com">',
      CIDS,
    );
    const srcs = [...read(srcdoc).querySelectorAll("img")].map((img) =>
      img.getAttribute("src"),
    );
    expect(srcs).toEqual(["blob:app.example/1", "cid:gone@example.com"]);
  });

  it("opens every link in a new tab without an opener or a referrer", () => {
    const { srcdoc } = prepareHtml(
      '<a href="https://example.com/a">a</a><a href="#b" target="_self">b</a>',
      CIDS,
    );
    for (const a of read(srcdoc).querySelectorAll("a")) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it.each([
    '<img src="https://example.com/pixel.gif">',
    '<img srcset="a.png 1x, //example.com/b.png 2x">',
    "<div style=\"background: url('http://example.com/bg.png')\"></div>",
    '<link rel="stylesheet" href="https://example.com/mail.css">',
    "<style>@import 'https://example.com/mail.css';</style>",
    '<table background="https://example.com/bg.png"></table>',
  ])("reports remote content in %s", (html) => {
    expect(prepareHtml(html, CIDS).remote).toBe(true);
  });

  it("reports none when the message carries everything", () => {
    const { remote } = prepareHtml(
      '<img src="cid:shot@example.com"><img src="data:image/png;base64,AAAA"><a href="https://example.com/">link</a>',
      CIDS,
    );
    expect(remote).toBe(false);
  });
});
