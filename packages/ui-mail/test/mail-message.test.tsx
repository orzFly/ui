import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MailMessage } from "../src/index.ts";

/** Whether postal-mime's chunk arrives, fails, or is still on its way. */
const chunk = vi.hoisted(() => ({
  state: "arrives" as "arrives" | "fails" | "waits",
  release: () => {},
}));

vi.mock("../src/load-postal-mime.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/load-postal-mime.ts")>();
  return {
    loadPostalMime: () => {
      if (chunk.state === "fails") {
        return Promise.reject(
          new Error("Failed to fetch dynamically imported module"),
        );
      }
      if (chunk.state === "waits") {
        return new Promise((resolve) => {
          chunk.release = () => resolve(actual.loadPostalMime());
        });
      }
      return actual.loadPostalMime();
    },
  };
});

afterEach(() => {
  chunk.state = "arrives";
});

const mail = (...lines: string[]) => lines.join("\r\n");

const PNG = "iVBORw0KGgo=";

const patches = Array.from({ length: 9 }, (_, i) =>
  mail(
    "--mixed",
    `Content-Type: application/octet-stream; name=000${i + 1}-fix.patch`,
    "Content-Disposition: attachment",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(`patch ${i + 1}\n`),
  ),
);

const SERIES = mail(
  "From: alice <noreply@example.com>",
  "To: dev@lists.example.com, bot-one <bot-one@example.com>, three@example.com, four@example.com",
  "Cc: newcomer <newcomer@example.com>",
  "Subject: [PATCH 0/9] Retry once",
  "Date: Tue, 20 Oct 2026 16:04:00 +0000",
  "Message-ID: <cover.1@example.com>",
  'Content-Type: multipart/mixed; boundary="mixed"',
  "",
  "--mixed",
  'Content-Type: multipart/alternative; boundary="alt"',
  "",
  "--alt",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Cover letter, see https://example.com/series.",
  "> quoted",
  "--alt",
  'Content-Type: multipart/related; boundary="rel"',
  "",
  "--rel",
  "Content-Type: text/html; charset=utf-8",
  "",
  '<p>Cover <a href="https://example.com/">letter</a></p><img src="cid:shot@example.com"><img src="https://example.com/pixel.gif">',
  "--rel",
  "Content-Type: image/png; name=inline.png",
  "Content-ID: <shot@example.com>",
  "Content-Transfer-Encoding: base64",
  "",
  PNG,
  "--rel--",
  "--alt--",
  ...patches,
  "--mixed",
  "Content-Type: image/png; name=screenshot.png",
  "Content-Disposition: attachment",
  "Content-Transfer-Encoding: base64",
  "",
  PNG,
  "--mixed--",
);

const HTML_ONLY = mail(
  "From: noreply@example.com",
  "Subject: html",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Only <b>HTML</b></p>",
);

const FLOWED = mail(
  "From: noreply@example.com",
  "Content-Type: text/plain; charset=utf-8; format=flowed",
  "",
  "A long line ",
  "that flows.",
);

async function draw(raw: string) {
  const view = render(<MailMessage raw={raw} />);
  await screen.findByRole("article");
  return view;
}

describe("MailMessage", () => {
  it("says it is reading, then shows the subject, sender, date and recipients", async () => {
    render(<MailMessage raw={SERIES} />);
    expect(screen.getByText("Reading message…")).toBeTruthy();
    await screen.findByRole("article");
    expect(screen.getByRole("heading").textContent).toBe(
      "[PATCH 0/9] Retry once",
    );
    expect(screen.getByText("alice")).toBeTruthy();
    expect(document.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-10-20T16:04:00.000Z",
    );
    expect(
      screen.getByText(
        "to dev@lists.example.com, bot-one, three@example.com and 2 more",
      ),
    ).toBeTruthy();
  });

  it("lists every header under Details, and folds them away again", async () => {
    await draw(SERIES);
    const details = screen.getByRole("button", { name: "Details" });
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Message-ID")).toBeNull();
    fireEvent.click(details);
    expect(details.getAttribute("aria-expanded")).toBe("true");
    const terms = [...document.querySelectorAll("dt")].map(
      (dt) => dt.textContent,
    );
    expect(terms).toEqual(["From", "To", "Cc", "Date", "Message-ID"]);
    expect(screen.getByText("<cover.1@example.com>")).toBeTruthy();
    fireEvent.click(details);
    expect(document.querySelector("dl")).toBeNull();
  });

  it("opens on the plain text and switches to the HTML", async () => {
    await draw(SERIES);
    const plain = screen.getByRole("button", { name: "Plain text" });
    expect(plain.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Message text" })).toBeTruthy();
    const link = screen.getByRole("link", {
      name: "https://example.com/series",
    });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("> quoted").className).toContain(
      "text-muted-foreground",
    );

    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    const frame = (await screen.findByTitle("Message")) as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    const srcdoc = frame.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain('http-equiv="Content-Security-Policy"');
    expect(srcdoc).not.toContain("cid:shot@example.com");
    expect(srcdoc).toMatch(/<img src="blob:[^"]+">/);
    expect(srcdoc).toContain('target="_blank" rel="noopener noreferrer"');
    expect(
      screen.getByText(
        "Remote images and styles in this message aren't loaded.",
      ),
    ).toBeTruthy();
  });

  it("lists every attachment unfolded, images as thumbnails, and hides the inline image under the HTML", async () => {
    await draw(SERIES);
    const rows = () =>
      [...document.querySelectorAll("li")].map(
        (li) => li.querySelector("span")?.textContent,
      );
    expect(
      document.querySelector("[data-testid=attachment-fold-toggle]"),
    ).toBeNull();
    expect(rows()).toHaveLength(9);
    const thumbnails = () =>
      [...document.querySelectorAll("section img")].map(
        (img) => img.closest("a")?.textContent,
      );
    expect(thumbnails()).toEqual(["inline.png", "screenshot.png"]);

    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    await screen.findByTitle("Message");
    expect(thumbnails()).toEqual(["screenshot.png"]);
    expect(rows()).toHaveLength(9);
  });

  it("draws an HTML-only message with no switch", async () => {
    await draw(HTML_ONLY);
    expect(screen.queryByRole("button", { name: "Plain text" })).toBeNull();
    expect(await screen.findByTitle("Message")).toBeTruthy();
    expect(
      screen.queryByText(
        "Remote images and styles in this message aren't loaded.",
      ),
    ).toBeNull();
  });

  it("wraps a flowed body instead of scrolling it", async () => {
    await draw(FLOWED);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText(/A long line/)).toBeTruthy();
    expect(screen.getByText("(no subject)")).toBeTruthy();
  });

  it("says when there is no text", async () => {
    await draw(mail("From: noreply@example.com", "Subject: empty", "", ""));
    expect(screen.getByText("This message has no text.")).toBeTruthy();
  });

  it("says when it cannot read the message", async () => {
    render(<MailMessage raw="not a message at all" />);
    expect(await screen.findByText("Couldn't read this message.")).toBeTruthy();
    expect(screen.getByText("No mail headers found.")).toBeTruthy();
  });

  it("says when the parser does not load, and loads it again on Retry", async () => {
    chunk.state = "fails";
    render(<MailMessage raw={HTML_ONLY} />);
    expect(
      await screen.findByText("Couldn't load the mail reader."),
    ).toBeTruthy();
    expect(
      screen.getByText("Failed to fetch dynamically imported module"),
    ).toBeTruthy();
    chunk.state = "waits";
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    // The failure stays while the retry runs, its Retry disabled.
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    chunk.state = "arrives";
    chunk.release();
    expect((await screen.findByRole("heading")).textContent).toBe("html");
  });
});
