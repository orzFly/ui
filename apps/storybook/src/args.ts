import { UPDATE_STORY_ARGS } from "storybook/internal/core-events";
import { addons } from "storybook/preview-api";

/**
 * The `updateArgs` of `useArgs`, without the hook: `argsUpdater(context)` in a
 * render or a decorator. React re-renders a story that holds React state on
 * its own, after Storybook has dropped the story's context, and `useArgs`
 * throws there; this sends the same event without a hook.
 */
export function argsUpdater<TArgs>(context: {
  id: string;
  args: TArgs;
}): (updatedArgs: Partial<TArgs>) => void {
  const storyId = context.id;
  return (updatedArgs) =>
    addons.getChannel().emit(UPDATE_STORY_ARGS, { storyId, updatedArgs });
}
