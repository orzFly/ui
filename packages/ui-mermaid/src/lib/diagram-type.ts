// Frontmatter is only frontmatter at the very top: a `---` line, then
// anything, then the next `---` line.
const FRONTMATTER = /^\s*---[ \t]*\r?\n[\s\S]*?\r?\n[ \t]*---[ \t]*(?:\r?\n|$)/;
// A directive may span lines, and its JSON closes braces right before `}%%`.
const DIRECTIVE = /%%\{[\s\S]*?\}%%/g;
const KEYWORD = /^[A-Za-z][\w-]*/;

/**
 * The keyword a mermaid source opens with, as its author spelled it
 * (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`), rather than the id
 * mermaid's parser reports: that one has several spellings for one type and
 * version suffixes, and is only known once the diagram is drawn.
 */
export function diagramType(text: string): string | undefined {
  const body = text.replace(FRONTMATTER, "").replace(DIRECTIVE, "");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("%%")) continue;
    return KEYWORD.exec(trimmed)?.[0];
  }
  return undefined;
}
