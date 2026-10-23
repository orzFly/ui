import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import {
  bytesSource,
  HEX_ENCODINGS,
  type HexEncoding,
  type HexSelection,
  HexView,
  type HexViewHandle,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useArgs } from "storybook/preview-api";
import {
  ENCODING_SAMPLES,
  HexFrame,
  SAMPLE_PNG,
  syntheticBytes,
  syntheticSource,
} from "./hex-fixtures.tsx";

const PNG = bytesSource(SAMPLE_PNG);

const meta = {
  title: "ui-hex/HexView",
  component: HexView,
  decorators: [
    (Story) => (
      <HexFrame>
        <Story />
      </HexFrame>
    ),
  ],
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
  },
} satisfies Meta<typeof HexView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: function BasicRender(args) {
    // The encoding arg makes the view controlled, so the picker has to write
    // back into the args or it could never change anything.
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <HexView
        {...args}
        onEncodingChange={(encoding) => updateArgs({ encoding })}
      />
    );
  },
};

const EMPTY = new Uint8Array(0);

function EncodingsDemo() {
  const [encoding, setEncoding] = useState<HexEncoding>("utf-8");
  // An encoding with no sample of its own shows the UTF-8 one, misread.
  const source = useMemo(
    () =>
      bytesSource(
        ENCODING_SAMPLES[encoding] ?? ENCODING_SAMPLES["utf-8"] ?? EMPTY,
      ),
    [encoding],
  );
  return (
    <HexView
      source={source}
      rows={6}
      encoding={encoding}
      onEncodingChange={setEncoding}
      aria-label="Encoding samples"
    />
  );
}

export const Encodings: Story = {
  render: () => <EncodingsDemo />,
};

function LargeInMemoryDemo() {
  // 64 MiB at 16 columns is past the 1:1 spacer cap, so this scrolls scaled.
  const source = useMemo(() => bytesSource(syntheticBytes(64 * 2 ** 20)), []);
  return (
    <HexFrame height={420}>
      <HexView source={source} aria-label="64 MiB in memory" />
    </HexFrame>
  );
}

export const LargeInMemory: Story = {
  render: () => <LargeInMemoryDemo />,
};

function PagedSourceDemo() {
  const source = useMemo(
    () => syntheticSource({ size: 2 ** 32, latencyMs: 80 }),
    [],
  );
  return (
    <HexFrame height={420}>
      <HexView source={source} aria-label="4 GiB paged" />
    </HexFrame>
  );
}

export const PagedSource: Story = {
  render: () => <PagedSourceDemo />,
};

function ControlledSelectionDemo() {
  const view = useRef<HexViewHandle>(null);
  const [selection, setSelection] = useState<HexSelection | null>({
    anchor: 0x10,
    focus: 0x1f,
    pane: "hex",
  });
  const [target, setTarget] = useState("0x400");
  const go = () => {
    const offset = Number(target);
    if (!Number.isInteger(offset) || offset < 0 || offset >= SAMPLE_PNG.length)
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
        ref={view}
        source={PNG}
        rows={12}
        selection={selection}
        onSelectionChange={setSelection}
        onCopy={(result) =>
          result.ok
            ? toast.success(`Copied ${result.bytes} bytes`)
            : toast.error(`Copy failed: ${result.reason}`)
        }
      />
      <pre className="text-muted-foreground text-xs">
        {JSON.stringify(selection)}
      </pre>
    </div>
  );
}

export const ControlledSelection: Story = {
  render: () => <ControlledSelectionDemo />,
};

function ReadErrorsDemo() {
  const [errors, setErrors] = useState<string[]>([]);
  const view = useRef<HexViewHandle>(null);
  // The view reads 64 KiB pages: the second one fails, and the view opens on
  // the boundary so both sides show.
  const source = useMemo(
    () => syntheticSource({ size: 4 * 65536, latencyMs: 120, failPage: 1 }),
    [],
  );
  useEffect(() => view.current?.scrollToOffset(0xffc0, "start"), []);
  return (
    <div className="grid gap-3">
      <HexView
        ref={view}
        source={source}
        rows={8}
        onReadError={(error, offset) =>
          setErrors((list) => [
            ...list,
            `0x${offset.toString(16)}: ${String(error)}`,
          ])
        }
      />
      <ul className="text-muted-foreground text-xs">
        {errors.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export const ReadErrors: Story = {
  render: () => <ReadErrorsDemo />,
};

// Drag the corner: the columns follow the width, 16, 8 or 4 at a time.
export const FitsWidth: Story = {
  args: { columns: "auto", resizable: true },
};
