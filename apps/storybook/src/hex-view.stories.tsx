import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import {
  bytesSource,
  HEX_ENCODINGS,
  type HexSelection,
  HexView,
  type HexViewHandle,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withHeight } from "./decorators.tsx";
import {
  ENCODING_SAMPLES,
  reportCopy,
  SAMPLE_PNG,
  syntheticBytes,
  syntheticSource,
} from "./fixtures/hex.ts";

const PNG = bytesSource(SAMPLE_PNG);
const EMPTY = new Uint8Array(0);

const PLAYGROUND = `import { bytesSource, HexView } from "@orz/ui-hex";
import "@orz/ui-hex/styles.css";

const source = bytesSource(bytes);

<HexView source={source} rows={16} />`;

const ENCODINGS = `const [encoding, setEncoding] = useState<HexEncoding>("utf-8");

<HexView source={source} encoding={encoding} onEncodingChange={setEncoding} />`;

const CONTROLLED_SELECTION = `const [selection, setSelection] = useState<HexSelection | null>({ anchor: 0x10, focus: 0x1f, pane: "hex" });

<HexView source={source} selection={selection} onSelectionChange={setSelection} />`;

const SCROLL_TO_OFFSET = `const view = useRef<HexViewHandle>(null);

function go(offset: number) {
  setSelection({ anchor: offset, focus: offset, pane: "hex" });
  view.current?.scrollToOffset(offset, "center");
  view.current?.focus();
}

<HexView ref={view} source={source} selection={selection} onSelectionChange={setSelection} />`;

const FITS_WIDTH = `<HexView source={source} columns="auto" resizable />`;

const meta = {
  title: "ui-hex/HexView",
  component: HexView,
  args: {
    source: PNG,
    rows: 16,
    columns: 16,
    groupSize: 8,
    baseAddress: 0,
    showAddresses: true,
    showColumnLabels: true,
    showText: true,
    showStatusBar: true,
    uppercase: true,
    fadeZeroBytes: true,
    controlCodes: "abbreviations",
    encoding: "ascii",
    showEncodingPicker: true,
    onCopy: reportCopy,
  },
  argTypes: {
    source: { control: false },
    controlCodes: {
      control: "inline-radio",
      options: ["abbreviations", "dots"],
    },
    encoding: {
      control: "select",
      options: HEX_ENCODINGS.map((info) => info.id),
    },
    selection: { control: "object" },
  },
  render: function Render(args, context) {
    // The encoding arg makes the view controlled, so the picker has to write
    // back into the args or it could never change anything.
    const updateArgs = argsUpdater(context);
    return (
      <HexView
        {...args}
        onEncodingChange={(encoding) => updateArgs({ encoding })}
      />
    );
  },
} satisfies Meta<typeof HexView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  parameters: { docs: { source: { code: PLAYGROUND, language: "tsx" } } },
};

/** An encoding with no sample of its own shows the UTF-8 one, misread. */
export const Encodings: Story = {
  args: { encoding: "utf-8", rows: 6, "aria-label": "Encoding samples" },
  parameters: { docs: { source: { code: ENCODINGS, language: "tsx" } } },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const source = useMemo(
      () =>
        bytesSource(
          ENCODING_SAMPLES[args.encoding ?? "utf-8"] ??
            ENCODING_SAMPLES["utf-8"] ??
            EMPTY,
        ),
      [args.encoding],
    );
    return (
      <HexView
        {...args}
        source={source}
        onEncodingChange={(encoding) => updateArgs({ encoding })}
      />
    );
  },
};

/** Edit `selection` in Controls to move it; the Actions panel logs each change. */
export const ControlledSelection: Story = {
  args: {
    rows: 12,
    selection: { anchor: 0x10, focus: 0x1f, pane: "hex" },
    onSelectionChange: fn(),
  },
  parameters: {
    docs: { source: { code: CONTROLLED_SELECTION, language: "tsx" } },
  },
  render: function Render(args, context) {
    // The selection changes on every pointer move while dragging: a late
    // write-back into the args would reset the drag, so state holds it.
    const updateArgs = argsUpdater(context);
    const [selection, setSelection] = useState(args.selection);
    useEffect(() => setSelection(args.selection), [args.selection]);
    return (
      <HexView
        {...args}
        onEncodingChange={(encoding) => updateArgs({ encoding })}
        selection={selection}
        onSelectionChange={(next) => {
          setSelection(next);
          args.onSelectionChange?.(next);
        }}
      />
    );
  },
};

export const ScrollToOffset: Story = {
  args: { rows: 12 },
  parameters: {
    docs: { source: { code: SCROLL_TO_OFFSET, language: "tsx" } },
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const view = useRef<HexViewHandle>(null);
    const [selection, setSelection] = useState<HexSelection | null>({
      anchor: 0x10,
      focus: 0x1f,
      pane: "hex",
    });
    const [target, setTarget] = useState("0x400");
    const go = () => {
      const offset = Number(target);
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset >= SAMPLE_PNG.length
      )
        return;
      setSelection({ anchor: offset, focus: offset, pane: "hex" });
      view.current?.scrollToOffset(offset, "center");
      view.current?.focus();
    };
    return (
      <div className="grid gap-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            go();
          }}
        >
          <Input
            className="w-40"
            aria-label="Offset"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <Button type="submit" variant="outline">
            Go to offset
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSelection(null)}
          >
            Clear
          </Button>
        </form>
        <HexView
          {...args}
          ref={view}
          onEncodingChange={(encoding) => updateArgs({ encoding })}
          selection={selection}
          onSelectionChange={setSelection}
        />
      </div>
    );
  },
};

// Drag the corner: the columns follow the width, 16, 8 or 4 at a time.
export const FitsWidth: Story = {
  args: { columns: "auto", resizable: true },
  parameters: { docs: { source: { code: FITS_WIDTH, language: "tsx" } } },
};

export const LargeInMemory: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withHeight(420)],
  render: function Render() {
    // 64 MiB at 16 columns is past the 1:1 spacer cap, so this scrolls scaled.
    const source = useMemo(() => bytesSource(syntheticBytes(64 * 2 ** 20)), []);
    return <HexView source={source} aria-label="64 MiB in memory" />;
  },
};

export const PagedSource: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withHeight(420)],
  render: function Render() {
    const source = useMemo(
      () => syntheticSource({ size: 2 ** 32, latencyMs: 80 }),
      [],
    );
    return <HexView source={source} aria-label="4 GiB paged" />;
  },
};

export const ReadErrors: Story = {
  tags: ["edge", "!autodocs"],
  args: { rows: 8, onReadError: fn() },
  render: function Render(args, context) {
    const view = useRef<HexViewHandle>(null);
    // The view reads 64 KiB pages: the second one fails, and the view opens on
    // the boundary so both sides show.
    const source = useMemo(
      () => syntheticSource({ size: 4 * 65536, latencyMs: 120, failPage: 1 }),
      [],
    );
    const updateArgs = argsUpdater(context);
    useEffect(() => view.current?.scrollToOffset(0xffc0, "start"), []);
    return (
      <HexView
        {...args}
        ref={view}
        source={source}
        onEncodingChange={(encoding) => updateArgs({ encoding })}
      />
    );
  },
};
