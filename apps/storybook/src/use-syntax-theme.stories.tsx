import {
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  redrawOnRemount,
  usePierreSyntaxTheme,
  useSyntaxTheme,
} from "@orz/ui-code";
import { MultiFileDiff } from "@pierre/diffs/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { useSyntaxTheme } from "@orz/ui-code";

const theme = useSyntaxTheme();
// { light: "github-light", dark: "github-dark" }: the active theme's shiki pair,
// or pierre's own "pierre-light" / "pierre-dark" where a palette names none.
// Stable per pair, so it can go straight into a memoised pierre options object.`;

const PIERRE_USAGE = `import {
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  redrawOnRemount,
  usePierreSyntaxTheme,
} from "@orz/ui-code";
import { MultiFileDiff } from "@pierre/diffs/react";

// null until pierre has loaded and a palette's own theme is registered with it.
const theme = usePierreSyntaxTheme();
const options = useMemo(
  () =>
    theme && {
      theme,
      themeType: PIERRE_THEME_TYPE,
      preferredHighlighter: PIERRE_HIGHLIGHTER,
      onPostRender: redrawOnRemount,
    },
  [theme],
);

options === null ? null : (
  <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
);`;

const OLD = `export function retry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  return run().catch((error: unknown) => {
    if (attempts <= 1) throw error;
    return wait(250).then(() => retry(run, attempts - 1));
  });
}
`;

const NEW = `export function retry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  return run().catch(async (error: unknown) => {
    if (attempts <= 1) throw error;
    await wait(250 * 2 ** (3 - attempts));
    return retry(run, attempts - 1);
  });
}
`;

const meta = {
  title: "ui-code/useSyntaxTheme",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick another theme or mode in the toolbar to watch it change. */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "ts" } } },
  render: function Render() {
    const theme = useSyntaxTheme();
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt>light</dt>
        <dd>
          <code>{theme.light}</code>
        </dd>
        <dt>dark</dt>
        <dd>
          <code>{theme.dark}</code>
        </dd>
      </dl>
    );
  },
};

/**
 * For a pierre component imported straight from `@pierre/diffs/react` rather than through
 * `LazyMultiFileDiff`: null until pierre has loaded and a palette's own syntax theme is registered
 * with it, as a Pro theme's is. `redrawOnRemount` redraws a container StrictMode or a Suspense
 * boundary hands to a second instance.
 */
export const UsePierreSyntaxTheme: Story = {
  name: "usePierreSyntaxTheme",
  parameters: { docs: { source: { code: PIERRE_USAGE, language: "tsx" } } },
  decorators: [withWidth("max-w-3xl")],
  render: function Render() {
    const theme = usePierreSyntaxTheme();
    const options = useMemo(
      () =>
        theme && {
          theme,
          themeType: PIERRE_THEME_TYPE,
          preferredHighlighter: PIERRE_HIGHLIGHTER,
          onPostRender: redrawOnRemount,
        },
      [theme],
    );
    // A story has to return an element, null or not.
    return (
      <>
        {options !== null && (
          <MultiFileDiff
            oldFile={{ name: "retry.ts", contents: OLD }}
            newFile={{ name: "retry.ts", contents: NEW }}
            options={options}
          />
        )}
      </>
    );
  },
};
