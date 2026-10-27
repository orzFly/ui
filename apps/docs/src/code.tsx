import { CodeBlock, fenceFilename } from "@orz/ui-code";
import { ClientOnly } from "./hydrated.tsx";

/**
 * A highlighted block. CodeBlock reaches pierre through lazy(), which
 * renderToString cannot wait for, so the prerendered page carries the plain
 * text CodeBlock itself shows until pierre has coloured it.
 */
export function Code({ lang, contents }: { lang: string; contents: string }) {
  return (
    <ClientOnly
      fallback={
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[0.85em] leading-[1.45]">
          <code>{contents}</code>
        </pre>
      }
    >
      <CodeBlock filename={fenceFilename(lang)} contents={contents} />
    </ClientOnly>
  );
}
