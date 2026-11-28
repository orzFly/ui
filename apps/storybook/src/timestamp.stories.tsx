import { Timestamp, TimestampProvider } from "@orz/ui/components/timestamp";
import type { Meta, StoryObj } from "@storybook/react-vite";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Counted back from the page's clock, so a relative time reads the same whenever it is opened.
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const lastYear = () => {
  const date = new Date(Date.now() - 2 * HOUR);
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString();
};

const FORMATS = ["datetime", "date", "relative"] as const;

const meta = {
  title: "ui/Primitives/Timestamp",
  component: Timestamp,
  parameters: { guidelines: "/guidelines/content/writing/" },
  args: { value: ago(2 * HOUR) },
  argTypes: {
    value: { control: "text" },
    format: { control: "inline-radio", options: FORMATS },
  },
} satisfies Meta<typeof Timestamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The three formats of one instant; each one's `title` is the instant in full. */
export const Formats: Story = {
  render: (args) => (
    <div className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1 text-ui">
      {FORMATS.map((format) => (
        <div key={format} className="contents">
          <span className="font-mono text-muted-foreground text-ui-sm">
            {format}
          </span>
          <Timestamp {...args} format={format} />
        </div>
      ))}
    </div>
  ),
};

/** Another year than this one is written out. */
export const OtherYear: Story = {
  args: { value: lastYear() },
};

/** A relative time from a moment to a week, ahead or behind, then the date. */
export const Relative: Story = {
  args: { format: "relative" },
  render: (args) => (
    <div className="flex flex-col gap-1 text-ui">
      {[
        20_000,
        4 * MINUTE,
        3 * HOUR,
        2 * DAY,
        10 * DAY,
        -2.5 * HOUR,
        -20 * DAY,
      ].map((ms) => (
        <Timestamp key={ms} {...args} value={ago(ms)} />
      ))}
    </div>
  ),
};

/**
 * An app's own locale or zone for the timestamps inside, and a fixed now for a test or a
 * screenshot, which stops relative times from ticking.
 */
export const Provider: Story = {
  parameters: {
    docs: {
      source: {
        code: `<TimestampProvider locale="ja" timeZone="Asia/Tokyo">
  <Timestamp value={createdAt} />
  <Timestamp value={updatedAt} format="relative" />
</TimestampProvider>`,
        language: "tsx",
      },
    },
  },
  render: (args) => (
    <TimestampProvider locale="ja" timeZone="Asia/Tokyo">
      <div className="flex flex-col gap-1 text-ui">
        <Timestamp {...args} />
        <Timestamp {...args} format="relative" />
      </div>
    </TimestampProvider>
  ),
};
