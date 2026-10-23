/** A module and an expression from it: `["@orz/ui-markdown", "markdownContent()"]`. */
export type Imported = readonly [from: string, expression: string];

export interface Registration {
  /** The renderers, in the order `ContentRenderers` tries them. */
  renderers: readonly Imported[];
  /** The JSX inside `<ContentRenderers>`, unindented. */
  body: string;
  /** What `body` uses, as `[module, name]`. */
  uses?: readonly Imported[];
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*/;

/**
 * The `docs.source.code` of a story on a `Content` page. The renderers go in a
 * constant because ContentRenderers wants a stable array; a docs snippet that
 * inlines `renderers={[…]}` would teach the opposite.
 */
export function registrationSnippet({
  renderers,
  body,
  uses = [],
}: Registration): string {
  const names = new Map<string, Set<string>>();
  const add = (from: string, name: string) => {
    const set = names.get(from) ?? new Set<string>();
    set.add(name);
    names.set(from, set);
  };
  add("@orz/ui-content", "ContentRenderers");
  for (const [from, expression] of [...renderers, ...uses]) {
    add(from, IDENTIFIER.exec(expression)?.[0] ?? expression);
  }
  const imports = [...names]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([from, set]) => {
      const list = [...set].sort((a, b) => a.localeCompare(b, "en"));
      return `import { ${list.join(", ")} } from "${from}";`;
    });
  const list = renderers.map(([, expression]) => expression).join(", ");
  const inner = body
    .trim()
    .split("\n")
    .map((l) => (l === "" ? l : `  ${l}`))
    .join("\n");
  return [
    ...imports,
    "",
    `const renderers = [${list}];`,
    "",
    "<ContentRenderers renderers={renderers}>",
    inner,
    "</ContentRenderers>",
  ].join("\n");
}
