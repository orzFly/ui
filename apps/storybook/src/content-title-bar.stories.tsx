import { file } from "@orz/fixtures/files.ts";
import { Button } from "@orz/ui/components/button";
import {
  Content,
  type ContentRenderer,
  type ContentSource,
  ContentTitleBar,
  useContentTitleBar,
  useSourceText,
} from "@orz/ui-content";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { createPortal } from "react-dom";
import { withRenderers, withWidth } from "./decorators.tsx";

/**
 * Draws any file's text, with a wrap toggle in the surface's title bar when one is lent for this
 * source, and in a row of its own when none is.
 */
const wrapToggle: ContentRenderer = {
  name: "wrap-toggle",
  accepts: (source) => source.kind === "file",
  Component: ({ source }) => {
    const bar = useContentTitleBar(source);
    const text = useSourceText(source);
    const [wrap, setWrap] = useState(false);
    const toggle = (
      <Button size="xs" variant="outline" onClick={() => setWrap((w) => !w)}>
        {wrap ? "No wrap" : "Wrap"}
      </Button>
    );
    return (
      <>
        {bar === undefined ? (
          <div className="mb-2 flex justify-end">{toggle}</div>
        ) : (
          bar && createPortal(toggle, bar)
        )}
        {text.status === "error" ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            {text.error.message}
            <Button size="xs" variant="outline" onClick={text.retry}>
              Retry
            </Button>
          </div>
        ) : (
          <pre
            className={
              wrap
                ? "text-xs whitespace-pre-wrap"
                : "overflow-x-auto text-xs whitespace-pre"
            }
          >
            {text.status === "ready" ? text.text : "loading…"}
          </pre>
        )}
      </>
    );
  },
};

let attempts = 0;

/** Fails every odd attempt and loads on every even one, so Retry has something to do. */
const FLAKY: ContentSource = {
  kind: "file",
  name: "flaky.txt",
  load: () => {
    attempts += 1;
    const attempt = attempts;
    return new Promise<string>((resolve, reject) =>
      setTimeout(
        () =>
          attempt % 2 === 1
            ? reject(new Error("503 Service Unavailable"))
            : resolve(`Loaded on attempt ${attempt}`),
        600,
      ),
    );
  },
};

const RENDERER = `import { Button } from "@orz/ui/components/button";
import { type ContentRenderer, useContentTitleBar, useSourceText } from "@orz/ui-content";
import { useState } from "react";
import { createPortal } from "react-dom";

const wrapToggle: ContentRenderer = {
  name: "wrap-toggle",
  accepts: (source) => source.kind === "file",
  Component: ({ source }) => {
    // Ask with the source you were given: the bar is lent to that object only.
    const bar = useContentTitleBar(source);
    const text = useSourceText(source);
    const [wrap, setWrap] = useState(false);
    const toggle = <Button onClick={() => setWrap((w) => !w)}>Wrap</Button>;
    return (
      <>
        {bar === undefined
          ? <div>{toggle}</div> // no surface lent a bar: draw a row of your own
          : bar && createPortal(toggle, bar)} {/* null while the bar mounts */}
        <pre>{text.text}</pre>
      </>
    );
  },
};`;

const PLAYGROUND = `import { Content, ContentTitleBar } from "@orz/ui-content";

// The surface: lends a spot in its header to the renderer drawing \`source\`.
export function FilePanel({ source }: { source: ContentSource }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return (
    <section>
      <header>
        {source.name}
        <span ref={setTarget} className="contents" />
      </header>
      <ContentTitleBar source={source} target={target}>
        <Content source={source} placement="document" />
      </ContentTitleBar>
    </section>
  );
}

// The renderer: portals its controls into that spot.
${RENDERER}`;

const NO_TITLE_BAR = `import { Content } from "@orz/ui-content";

// No ContentTitleBar around it: useContentTitleBar(source) is undefined,
// so the renderer takes its \`bar === undefined\` branch and draws its own row.
<Content source={file} placement="document" />

${RENDERER}`;

const USE_SOURCE_TEXT = `import { useSourceText } from "@orz/ui-content";

// Inside a renderer's Component:
const text = useSourceText(source); // { status: "loading" | "ready" | "error", text?, error?, retry }
if (text.status === "error") {
  return (
    <div>
      {text.error.message}
      <Button onClick={text.retry}>Retry</Button>
    </div>
  );
}
return <pre>{text.status === "ready" ? text.text : "loading…"}</pre>;`;

const code = (snippet: string) => ({
  docs: { source: { code: snippet, language: "tsx" } },
});

/**
 * Lends a spot in a surface's title bar to the renderer that draws `source`, for controls that
 * belong next to the surface's own. The renderer finds it with `useContentTitleBar(source)`.
 */
const meta = {
  title: "ui-content/ContentTitleBar",
  component: ContentTitleBar,
  args: { source: file("fetch-task.ts"), target: null },
  argTypes: { target: { control: false }, children: { control: false } },
  decorators: [withWidth("max-w-xl"), withRenderers(wrapToggle)],
} satisfies Meta<typeof ContentTitleBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The toggle sits in the surface's header, next to the file name. */
export const Playground: Story = {
  render: function Render(args) {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    return (
      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/40 py-1 pr-1.5 pl-3 text-sm">
          <span className="flex-1 font-medium">
            {args.source.kind === "file" ? args.source.name : "inline"}
          </span>
          <span ref={setTarget} className="contents" />
        </div>
        <div className="p-3">
          <ContentTitleBar source={args.source} target={target}>
            <Content source={args.source} placement="document" />
          </ContentTitleBar>
        </div>
      </section>
    );
  },
  parameters: code(PLAYGROUND),
};

/** No surface lends a bar, so the renderer draws a toggle row of its own. */
export const NoTitleBar: Story = {
  render: (args) => <Content source={args.source} placement="document" />,
  parameters: code(NO_TITLE_BAR),
};

/** A file whose first load fails: loading, then the error with Retry, then the text. */
export const UseSourceText: Story = {
  name: "useSourceText",
  render: () => <Content source={FLAKY} placement="document" />,
  parameters: code(USE_SOURCE_TEXT),
};
