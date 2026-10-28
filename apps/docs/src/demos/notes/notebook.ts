import { FILES } from "@orz/fixtures/files.ts";
import { NOTE_FOLDERS, NOTES, type Note } from "@orz/fixtures/notes.ts";
import type { ContentSource } from "@orz/ui-content";

export { NOTE_FOLDERS, NOTES, type Note };

/** Code is text a tag or a title could be quoted in, never one itself. */
const withoutCode = (body: string) =>
  body.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");

/** The first heading, or the first line when there is none: a notebook titles a note by its text. */
export function titleOf(body: string): string {
  const text = withoutCode(body);
  const heading = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(text)?.[1];
  if (heading) return heading;
  const line = text.split("\n").find((each) => each.trim() !== "");
  return line?.trim().slice(0, 80) || "Untitled";
}

/**
 * Every `#word` outside code, lowercased, each once. A heading's `#` is followed by a space and a
 * link's fragment by no space before it, so neither counts.
 */
export function tagsOf(body: string): string[] {
  const tags = withoutCode(body).matchAll(/(?:^|[\s(])#([a-z][\w-]*)/gim);
  return [...new Set([...tags].map(([, tag]) => (tag ?? "").toLowerCase()))];
}

/** The text after the title, markdown punctuation dropped, for a line under it in the list. */
export function snippetOf(body: string): string {
  return withoutCode(body)
    .replace(/^#{1,6}[ \t].*$/m, "")
    .replace(/^\|?[\s:|-]+\|?$/gm, "")
    .replace(/(?:^|\s)#[a-z][\w-]*/gim, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+>]|\d+\.)\s+(?:\[[ x]\]\s+)?/gim, "")
    .replace(/[*_|#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter((word) => /\w/.test(word)).length;
}

/** Whether a note answers a filter: every word of `query` in its text, and every tag in `tags`. */
export function matches(
  body: string,
  query: string,
  tags: ReadonlySet<string>,
): boolean {
  const text = body.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const own = tagsOf(body);
  return (
    words.every((word) => text.includes(word)) &&
    [...tags].every((tag) => own.includes(tag))
  );
}

/** How many notes carry each tag, most used first, ties by name. */
export function tagCounts(bodies: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    for (const tag of tagsOf(body)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort(([a, m], [b, n]) => n - m || a.localeCompare(b));
}

/**
 * An address in a note to the file it names. Notes write `files/<name>`, as an app writes its
 * attachments' paths; react-markdown would refuse a `blob:` URL written into the text.
 */
export function resolveFile(href: string): ContentSource | null {
  const name = /^files\/(.+)$/.exec(href)?.[1];
  return name === undefined ? null : (FILES[name] ?? null);
}
