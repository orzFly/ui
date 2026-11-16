/**
 * Mail messages as `git send-email` and a mail client write them, put together here rather than
 * kept as `.eml` files: the patches are `patch/series.patch`'s and the screenshot is
 * `attachment/gradient.png`, so the messages follow them.
 */
import pngDataUrl from "./attachment/gradient.png?inline";
import seriesText from "./patch/series.patch?raw";

const CRLF = "\r\n";

const lines = (...parts: string[]) => parts.join(CRLF);

/** Base64 in 76-column lines, as RFC 2045 writes it. */
function wrap(base64: string): string {
  return base64.replace(/.{1,76}/g, (line) => `${line}${CRLF}`).trimEnd();
}

function base64Text(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return wrap(btoa(binary));
}

const PNG_BASE64 = wrap(pngDataUrl.slice(pngDataUrl.indexOf(",") + 1));

const PATCHES = seriesText.split(/\n(?=From [0-9a-f]{40} )/);

const HAR = JSON.stringify(
  {
    log: {
      version: "1.2",
      creator: { name: "devtools", version: "1" },
      entries: [
        {
          startedDateTime: "2026-10-20T15:58:02.114Z",
          time: 30012,
          request: { method: "GET", url: "https://app.example/api/tasks/42" },
          response: { status: 0, statusText: "net::ERR_TIMED_OUT" },
        },
        {
          startedDateTime: "2026-10-20T15:58:32.380Z",
          time: 84,
          request: { method: "GET", url: "https://app.example/api/tasks/42" },
          response: { status: 200, statusText: "OK" },
        },
      ],
    },
  },
  null,
  2,
);

const COVER_TEXT = lines(
  "A flaky network used to fail a whole task on its first error. This",
  "series retries a failed fetch once, after a short pause, and says so",
  "in the README. See https://app.example/tasks/42 for the report.",
  "",
  "The screenshot is the retry in the network panel, and the HAR is the",
  "same session.",
  "",
  "> Can it retry more than once?",
  "",
  "Not in this series: one retry covers the blips we have seen, and a",
  "second would hide a real outage for longer.",
  "",
  "alice (1):",
  "  feat: retry a failed fetch once before giving up",
  "",
  "bot-one (1):",
  "  docs: say what fetchTask does on a network error",
  "",
  " README.md         |  4 ++++",
  " src/fetch-task.ts | 14 +++++++++-----",
  " src/retry.ts      | 11 +++++++++++",
  " 3 files changed, 24 insertions(+), 5 deletions(-)",
  "",
  "-- ",
  "2.47.0",
);

const COVER_HTML = lines(
  "<!doctype html>",
  '<html><body style="font-family: sans-serif; font-size: 14px; color: #222">',
  '<p>A flaky network used to fail a whole task on its first error. This series retries a failed fetch once, after a short pause, and says so in the README. See <a href="https://app.example/tasks/42">the report</a>.</p>',
  "<p>The screenshot is the retry in the network panel, and the HAR is the same session.</p>",
  '<blockquote style="margin: 0 0 0 8px; padding-left: 8px; border-left: 2px solid #ccc; color: #555">Can it retry more than once?</blockquote>',
  "<p>Not in this series: one retry covers the blips we have seen, and a second would hide a real outage for longer.</p>",
  '<pre style="font-size: 12px">alice (1):\n  feat: retry a failed fetch once before giving up\n\nbot-one (1):\n  docs: say what fetchTask does on a network error</pre>',
  "</body></html>",
);

/**
 * A patch series' cover letter: plain and HTML bodies, two patches sent as
 * `application/octet-stream`, a screenshot and a HAR.
 */
export const SERIES_EML = lines(
  "From: alice <noreply@example.com>",
  "To: dev@lists.example.com",
  "Cc: bot-one <bot-one@example.com>, newcomer <newcomer@example.com>",
  "Subject: [PATCH 0/2] Retry a failed fetch once before giving up",
  "Date: Tue, 20 Oct 2026 16:04:27 +0000",
  "Message-ID: <cover.1760976267.git.noreply@example.com>",
  "In-Reply-To: <report-42@example.com>",
  "References: <report-42@example.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="=-series-mixed"',
  "",
  "This is a multi-part message in MIME format.",
  "",
  "--=-series-mixed",
  'Content-Type: multipart/alternative; boundary="=-series-alt"',
  "",
  "--=-series-alt",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: 7bit",
  "",
  COVER_TEXT,
  "",
  "--=-series-alt",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  base64Text(COVER_HTML),
  "--=-series-alt--",
  "",
  ...PATCHES.flatMap((patch, i) => {
    const name =
      i === 0
        ? "0001-feat-retry-a-failed-fetch-once-before-giving-up.patch"
        : "0002-docs-say-what-fetchTask-does-on-a-network-error.patch";
    return [
      "--=-series-mixed",
      `Content-Type: application/octet-stream; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(patch.endsWith("\n") ? patch : `${patch}\n`),
    ];
  }),
  "--=-series-mixed",
  'Content-Type: image/png; name="retry-network-panel.png"',
  'Content-Disposition: attachment; filename="retry-network-panel.png"',
  "Content-Transfer-Encoding: base64",
  "",
  PNG_BASE64,
  "--=-series-mixed",
  'Content-Type: application/octet-stream; name="retry-session.har"',
  'Content-Disposition: attachment; filename="retry-session.har"',
  "Content-Transfer-Encoding: base64",
  "",
  base64Text(HAR),
  "--=-series-mixed--",
  "",
);

/** A `format=flowed` reply: soft breaks the reader's width may rewrap, and quoted lines. */
export const FLOWED_EML = lines(
  "From: newcomer <newcomer@example.com>",
  "To: alice <noreply@example.com>",
  "Cc: dev@lists.example.com",
  "Subject: Re: [PATCH 0/2] Retry a failed fetch once before giving up",
  "Date: Wed, 21 Oct 2026 08:12:05 +0200",
  "Message-ID: <reply-1@example.com>",
  "In-Reply-To: <cover.1760976267.git.noreply@example.com>",
  "References: <report-42@example.com> <cover.1760976267.git.noreply@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8; format=flowed",
  "Content-Transfer-Encoding: 7bit",
  "",
  "On 20/10/2026 18:04, alice wrote:",
  "> A flaky network used to fail a whole task on its first error. This ",
  "> series retries a failed fetch once, after a short pause, and says so ",
  "> in the README.",
  "",
  "Thanks, this fixes the timeouts we see on the train every morning. I ",
  "tried it against the staging server with the network throttled, and ",
  "the second attempt went through every time.",
  "",
  "One question on the pause: a quarter of a second is shorter than most ",
  "of the blips I measured, so would half a second be a safer default? ",
  "Happy to send a follow-up if you agree.",
  "",
  "Tested-by: newcomer <newcomer@example.com>",
  "",
);

/**
 * An HTML-only message: an inline image by Content-ID, and a remote tracking
 * pixel that is never fetched.
 */
export const HTML_ONLY_EML = lines(
  "From: bot-one <bot-one@example.com>",
  "To: alice <noreply@example.com>",
  "Subject: Build passed: retry-once",
  "Date: Tue, 20 Oct 2026 16:20:11 +0000",
  "Message-ID: <build-317@example.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/related; boundary="=-build-related"',
  "",
  "--=-build-related",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  base64Text(
    lines(
      "<!doctype html>",
      '<html><body style="font-family: sans-serif; font-size: 14px; color: #222; margin: 16px">',
      '<h1 style="font-size: 18px; margin: 0 0 8px">Build 317 passed</h1>',
      '<p>Branch <code>retry-once</code>, all 214 tests green in 3m 12s. <a href="https://app.example/builds/317">Open the build</a>.</p>',
      '<p><img src="cid:coverage@example.com" alt="Coverage over the last ten builds" width="240"></p>',
      '<img src="https://example.com/pixel.gif" width="1" height="1" alt="">',
      "</body></html>",
    ),
  ),
  "--=-build-related",
  'Content-Type: image/png; name="coverage.png"',
  "Content-ID: <coverage@example.com>",
  "Content-Disposition: inline",
  "Content-Transfer-Encoding: base64",
  "",
  PNG_BASE64,
  "--=-build-related--",
  "",
);

/**
 * An encoded-word subject and an 8bit `iso-8859-1` body, written here as the
 * bytes' code points: read as a UTF-8 string they garble, read as bytes they
 * do not.
 */
export const ENCODED_EML = lines(
  "From: =?iso-8859-1?Q?Ren=E9e?= <noreply@example.com>",
  "To: =?utf-8?B?TsOpbcOpc2lz?= <newcomer@example.com>",
  "Subject: =?iso-8859-1?Q?R=E9sum=E9_du_caf=E9?= =?utf-8?B?IOKAlCDDqXTDqQ==?=",
  "Date: Mon, 19 Oct 2026 11:30:00 +0200",
  "Message-ID: <encoded-1@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=iso-8859-1",
  "Content-Transfer-Encoding: 8bit",
  "",
  "Bonjour,",
  "",
  "Le caf\xE9 de la r\xE9union est d\xE9plac\xE9 \xE0 jeudi. Les cr\xEApes",
  "restent au menu, et la na\xEFvet\xE9 aussi.",
  "",
  "\xC0 bient\xF4t,",
  "Ren\xE9e",
  "",
);

export const ENCODED_EML_BYTES = Uint8Array.from(ENCODED_EML, (c) =>
  c.charCodeAt(0),
);
