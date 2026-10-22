import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import type { ComponentType } from "react";
import { MermaidBlock } from "./mermaid-block.tsx";

type MermaidProps = ContentProps & { Next: ComponentType<ContentProps> };

function isMermaid(source: ContentSource): boolean {
  if (source.kind === "inline") return source.lang?.toLowerCase() === "mermaid";
  return /\.(mmd|mermaid)$/i.test(source.name);
}

function MermaidFile({ source, placement, className, Next }: MermaidProps) {
  const text = useSourceText(source);
  if (text.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (text.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{text.error.message}</span>{" "}
        <Button size="xs" variant="outline" onClick={text.retry}>
          Retry
        </Button>
      </div>
    );
  }
  // Handed on as inline text, not as the file: the code renderer below would
  // load the file a second time, while the diagram is still rendering. Inline
  // text is spelled as a fence's contents, without the file's final newline,
  // which a code view would draw as an empty last line.
  return (
    <MermaidBlock
      source={text.text}
      className={className}
      sourceView={
        <Next
          source={{
            kind: "inline",
            text: text.text.replace(/\r?\n$/, ""),
            lang: "mermaid",
          }}
          placement={placement}
        />
      }
    />
  );
}

function Mermaid(props: MermaidProps) {
  const { source, placement, className, Next } = props;
  if (source.kind === "file") return <MermaidFile {...props} />;
  return (
    <MermaidBlock
      source={source.text}
      className={className}
      sourceView={<Next source={source} placement={placement} />}
    />
  );
}

/**
 * The registry entry for mermaid: a source tagged `mermaid` (a fenced block) and a `.mmd` or
 * `.mermaid` file, in either placement. Register it before any renderer that takes every inline
 * source, such as a code renderer, which then draws the diagram's source view through `Next`.
 */
export const mermaidContent: ContentRenderer = {
  name: "mermaid",
  accepts: isMermaid,
  display: "block",
  Component: Mermaid,
};
