import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import type { Meta, StoryObj } from "@storybook/react-vite";

/** Accepts inline text tagged `shout` only: a narrow renderer, so it goes first. */
const shout: ContentRenderer = {
  name: "shout",
  accepts: (source) => source.kind === "inline" && source.lang === "shout",
  display: "inline",
  Component: ({ source, className }) => (
    <strong className={className} style={{ letterSpacing: "0.05em" }}>
      {source.kind === "inline" ? source.text.toUpperCase() : null}
    </strong>
  ),
};

/** Accepts every file and frames whatever the renderers after it draw. */
const framed: ContentRenderer = {
  name: "framed",
  accepts: (source) => source.kind === "file",
  Component: ({ Next, ...props }) => (
    <figure className="my-2 rounded-lg border p-3">
      <Next {...props} />
      <figcaption className="mt-2 text-xs text-muted-foreground">
        drawn by “framed”, then handed to Next
      </figcaption>
    </figure>
  ),
};

const RENDERERS = [shout, framed];

type Row = { label: string; source: ContentSource };

const ROWS: Row[] = [
  {
    label: "Inline, lang “shout”: the first renderer accepts it",
    source: { kind: "inline", text: "hello there", lang: "shout" },
  },
  {
    label: "Inline, lang “ts”: nothing accepts it, so the <pre> fallback",
    source: { kind: "inline", text: "const answer = 42;", lang: "ts" },
  },
  {
    label: "File with a url: framed, then Next reaches the download link",
    source: { kind: "file", name: "report.zip", url: "#report.zip" },
  },
  {
    label: "File without a url: framed, then Next reaches the bare name",
    source: { kind: "file", name: "notes.bin" },
  },
];

function Registry({ registered }: { registered: boolean }) {
  const body = (
    <div className="flex max-w-xl flex-col gap-4 text-sm">
      {ROWS.map((row) => (
        <section key={row.label} className="flex flex-col gap-1">
          <h3 className="font-medium">{row.label}</h3>
          <Content source={row.source} placement="document" />
        </section>
      ))}
    </div>
  );
  return registered ? (
    <ContentRenderers renderers={RENDERERS}>{body}</ContentRenderers>
  ) : (
    body
  );
}

const meta = {
  title: "Content/Registry",
  component: Registry,
  args: { registered: true },
} satisfies Meta<typeof Registry>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two toy renderers: one narrow inline renderer, and a frame that hands every file to `Next`. */
export const Dispatch: Story = {};

/** With no `<ContentRenderers>` around them, every source reaches the built-in fallback. */
export const Fallbacks: Story = { args: { registered: false } };
