/**
 * Everything a remote fetch could leak (that the message was opened, when, from where) is
 * refused by this policy, not by rewriting the markup: a reference the scan below misses is still
 * blocked. Inline styles stay, since mail is styled almost entirely by them.
 */
const CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:";

const REMOTE = /^\s*(?:https?:)?\/\//i;
const REMOTE_URL = /url\(\s*['"]?\s*(?:https?:)?\/\//i;

function isRemoteSrcset(srcset: string): boolean {
  return srcset.split(",").some((candidate) => REMOTE.test(candidate));
}

/** Whether the document asks for anything off the network: the reader is told it was not loaded. */
function hasRemote(doc: Document): boolean {
  for (const img of doc.querySelectorAll("img")) {
    if (REMOTE.test(img.getAttribute("src") ?? "")) return true;
    if (isRemoteSrcset(img.getAttribute("srcset") ?? "")) return true;
  }
  for (const source of doc.querySelectorAll("source[srcset]")) {
    if (isRemoteSrcset(source.getAttribute("srcset") ?? "")) return true;
  }
  for (const el of doc.querySelectorAll("[background]")) {
    if (REMOTE.test(el.getAttribute("background") ?? "")) return true;
  }
  for (const link of doc.querySelectorAll("link[href]")) {
    if (REMOTE.test(link.getAttribute("href") ?? "")) return true;
  }
  for (const style of doc.querySelectorAll("style")) {
    if (REMOTE_URL.test(style.textContent ?? "")) return true;
    if (/@import\s+['"]?\s*(?:https?:)?\/\//i.test(style.textContent ?? "")) {
      return true;
    }
  }
  for (const el of doc.querySelectorAll("[style]")) {
    if (REMOTE_URL.test(el.getAttribute("style") ?? "")) return true;
  }
  return false;
}

function replaceCid(value: string, cidUrls: Map<string, string>): string {
  if (!/^\s*cid:/i.test(value)) return value;
  const id = decodeURIComponent(value.trim().slice(4)).replace(/^<|>$/g, "");
  return cidUrls.get(id) ?? value;
}

/**
 * Readies an HTML body for a sandboxed `srcdoc`: `cid:` references point at the parts' blob URLs,
 * links open in a new tab, and the head opens with the content policy, so the frame loads only
 * what the message carries. `DOMParser` runs no script and fetches nothing while it reads.
 */
export function prepareHtml(
  html: string,
  cidUrls: Map<string, string>,
): { srcdoc: string; remote: boolean } {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const el of doc.querySelectorAll("[src]")) {
    el.setAttribute("src", replaceCid(el.getAttribute("src") ?? "", cidUrls));
  }
  for (const el of doc.querySelectorAll("[background]")) {
    el.setAttribute(
      "background",
      replaceCid(el.getAttribute("background") ?? "", cidUrls),
    );
  }
  for (const a of doc.querySelectorAll("a")) {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  }
  const remote = hasRemote(doc);

  const head = doc.head;
  const charset = doc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const policy = doc.createElement("meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", CSP);
  const referrer = doc.createElement("meta");
  referrer.setAttribute("name", "referrer");
  referrer.setAttribute("content", "no-referrer");
  // Mail is written for a white page; under a dark theme it stays one, a
  // sheet of paper on the dark ground, rather than black text on black.
  const paper = doc.createElement("style");
  paper.textContent = ":root{color-scheme:light;background:#fff}";
  head.prepend(charset, policy, referrer, paper);

  return {
    srcdoc: `<!doctype html>${doc.documentElement.outerHTML}`,
    remote,
  };
}
