import { CodeBlock, fenceFilename } from "@orz/ui-code";

/**
 * A highlighted block. CodeBlock fetches pierre's chunk in the browser only,
 * so on the server, and through hydration, it draws its own plain text, laid
 * out as the highlighted block will be.
 */
export function Code({ lang, contents }: { lang: string; contents: string }) {
  return <CodeBlock filename={fenceFilename(lang)} contents={contents} />;
}
