import {
  LazyMultiFileDiff,
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  useSyntaxTheme,
} from "@orz/ui-code";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { Suspense, useMemo } from "react";
import { withWidth } from "./decorators.tsx";

/** A `<Suspense>` boundary, for the lazy `LazyMultiFileDiff`. */
const withSuspense: Decorator = (Story) => (
  <Suspense fallback={null}>
    <Story />
  </Suspense>
);

const OLD = `export function retry<T>(
  run: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  return run().catch((error: unknown) => {
    if (attempts <= 1) throw error;
    return wait(250).then(() => retry(run, attempts - 1));
  });
}
`;

const NEW = `export function retry<T>(
  run: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  return run().catch(async (error: unknown) => {
    if (attempts <= 1) throw error;
    await wait(250 * 2 ** (3 - attempts));
    return retry(run, attempts - 1);
  });
}
`;

const USAGE = `import {
  LazyMultiFileDiff,
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  useSyntaxTheme,
} from "@orz/ui-code";

const theme = useSyntaxTheme();
const options = useMemo(
  () => ({
    theme,
    themeType: PIERRE_THEME_TYPE,
    preferredHighlighter: PIERRE_HIGHLIGHTER,
  }),
  [theme],
);

<Suspense>
  <LazyMultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
</Suspense>;`;

/**
 * pierre's `MultiFileDiff` behind `lazy()`, for a diff surface of your own that matches the blocks.
 * It needs a `<Suspense>` above it, and options that name `PIERRE_HIGHLIGHTER`: another
 * highlighter would split pierre's singleton.
 */
const meta = {
  title: "ui-code/LazyMultiFileDiff",
  component: LazyMultiFileDiff,
  args: {
    oldFile: { name: "retry.ts", contents: OLD },
    newFile: { name: "retry.ts", contents: NEW },
  },
  argTypes: { options: { control: false } },
  decorators: [withSuspense, withWidth("max-w-3xl")],
} satisfies Meta<typeof LazyMultiFileDiff>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Options built from `useSyntaxTheme` and the `PIERRE_*` constants, as the blocks build theirs. */
export const Playground: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render(args) {
    const theme = useSyntaxTheme();
    const options = useMemo(
      () => ({
        theme,
        themeType: PIERRE_THEME_TYPE,
        preferredHighlighter: PIERRE_HIGHLIGHTER,
      }),
      [theme],
    );
    return <LazyMultiFileDiff {...args} options={options} />;
  },
};
