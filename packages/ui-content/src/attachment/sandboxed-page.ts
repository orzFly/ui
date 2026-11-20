/**
 * A page that shows `src` inside a frame sandboxed to scripts alone, as a
 * Blob for `URL.createObjectURL`: what "Open in new tab" opens for a file
 * that is only an object URL so far, a staged one say. Opened bare, the
 * object URL would run in the app's own origin, with its cookies and
 * storage, and an object URL has no response to carry a CSP sandbox; the
 * frame's opaque origin reaches neither. The caller revokes the URL it made.
 */
export function sandboxedPage(title: string, src: string): Blob {
  const entities = (text: string) =>
    text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const name = entities(title);
  const html =
    `<!doctype html><meta charset="utf-8"><title>${name}</title>` +
    "<style>html,body{margin:0;height:100%}" +
    "iframe{display:block;width:100%;height:100%;border:0}</style>" +
    `<iframe sandbox="allow-scripts" title="${name}" src="${entities(src)}"></iframe>`;
  return new Blob([html], { type: "text/html" });
}
