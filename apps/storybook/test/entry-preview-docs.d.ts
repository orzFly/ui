// The entry ships no types; these are the two exports the test drives.
declare module "@storybook/react/entry-preview-docs" {
  import type { ReactRenderer } from "@storybook/react";
  import type {
    DecoratorApplicator,
    DecoratorFunction,
  } from "storybook/internal/types";

  export const decorators: DecoratorFunction<ReactRenderer>[];
  export const applyDecorators: DecoratorApplicator<ReactRenderer>;
}
