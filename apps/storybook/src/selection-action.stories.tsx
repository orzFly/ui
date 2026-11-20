import { Button } from "@orz/ui/components/button";
import { Pane } from "@orz/ui/components/pane";
import {
  SelectionAction,
  SelectionActionProvider,
  useSelectionRegion,
} from "@orz/ui/components/selection-action";
import { Textarea } from "@orz/ui/components/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyIcon, TextQuoteIcon } from "lucide-react";
import { useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import {
  SelectionAction,
  SelectionActionProvider,
  useSelectionRegion,
} from "@orz/ui/components/selection-action";

function Comment({ comment }: { comment: Comment }) {
  // Text selected inside this element, and only inside it, brings up the action.
  const region = useSelectionRegion(comment);
  return (
    <article>
      <header>{comment.author} commented</header>
      <div ref={region}>{comment.body}</div>
    </article>
  );
}

<SelectionActionProvider>
  {comments.map((comment) => <Comment key={comment.id} comment={comment} />)}
  <SelectionAction<Comment>>
    {({ text, value, dismiss }) => (
      <Button
        size="sm"
        onClick={() => {
          quote(value.author, text);
          dismiss();
        }}
      >
        <TextQuoteIcon />
        Quote reply
      </Button>
    )}
  </SelectionAction>
</SelectionActionProvider>`;

const meta = {
  title: "ui/SelectionAction",
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  decorators: [
    withWidth("max-w-lg"),
    (Story) => (
      <SelectionActionProvider>
        <Story />
      </SelectionActionProvider>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const BODY =
  "The retry loop backs off twice as long each time, up to a minute. A job that still fails after that is parked, and the dashboard lists it under Stuck.";

/**
 * Select a few words of the comment: Quote reply comes up under them and puts them in the reply
 * box. Select across into the heading and nothing comes up, as the selection is no longer the
 * comment's alone. On a touch screen the action is a bar along the window's foot.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const region = useSelectionRegion("alice");
    const [reply, setReply] = useState("");
    return (
      <div className="grid gap-3">
        <Pane purpose="document" frame="card" asChild>
          <article>
            <header className="border-b px-3 py-2 font-medium text-ui">
              alice commented
            </header>
            <p ref={region} className="p-3 text-ui">
              {BODY}
            </p>
          </article>
        </Pane>
        <Textarea
          aria-label="Reply"
          placeholder="Reply…"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
        />
        <SelectionAction<string>>
          {({ text, value, dismiss }) => (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(text);
                  dismiss();
                }}
              >
                <CopyIcon />
                Copy
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const quoted = text
                    .split("\n")
                    .map((line) => `> ${line}`)
                    .join("\n");
                  setReply((was) =>
                    `${was}${was ? "\n\n" : ""}${value} wrote:\n${quoted}\n\n`.trimStart(),
                  );
                  dismiss();
                }}
              >
                <TextQuoteIcon />
                Quote reply
              </Button>
            </>
          )}
        </SelectionAction>
      </div>
    );
  },
};
