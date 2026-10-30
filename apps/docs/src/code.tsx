import { CodeBlock, fenceFilename } from "@orz/ui-code";
import { ClientOnly } from "./hydrated.tsx";

/**
 * A highlighted block. CodeBlock reaches pierre through lazy(), which
 * renderToString cannot wait for, so the prerendered page carries the plain
 * text CodeBlock itself shows until pierre has coloured it, beside the space
 * its Copy button takes.
 */
export function Code({ lang, contents }: { lang: string; contents: string }) {
  return (
    <ClientOnly
      fallback={
        <div className="flex">
          <pre className="min-w-0 flex-1 overflow-x-auto bg-muted p-3 text-[0.85em] leading-[1.45]">
            <code>{contents}</code>
          </pre>
          <span className="m-1 size-control-sm shrink-0" />
        </div>
      }
    >
      <CodeBlock filename={fenceFilename(lang)} contents={contents} />
    </ClientOnly>
  );
}
