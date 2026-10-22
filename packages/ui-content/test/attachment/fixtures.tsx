import type { ReactNode } from "react";
import type { FileSource } from "../../src/attachment/index.ts";
import { type ContentRenderer, ContentRenderers } from "../../src/index.ts";

/** Stands in for the text renderers other packages register: takes `.txt` in both placements. */
export const stubText: ContentRenderer = {
  name: "stub",
  accepts: (source) => source.kind === "file" && /\.txt$/.test(source.name),
  Component: ({ source, className }) => (
    <span data-testid="stub" className={className}>
      stub:{source.kind === "file" ? source.name : ""}
    </span>
  ),
};

export const file = (
  name: string,
  extra: Partial<Omit<FileSource, "kind" | "name">> = {},
): FileSource => ({
  kind: "file",
  name,
  url: `https://app.example/files/${name}`,
  ...extra,
});

export function withRenderers(
  renderers: readonly ContentRenderer[],
  children: ReactNode,
) {
  return <ContentRenderers renderers={renderers}>{children}</ContentRenderers>;
}
