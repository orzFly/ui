import type { ReactRenderer } from "@storybook/react";
import {
  applyDecorators,
  decorators,
} from "@storybook/react/entry-preview-docs";
import { FileTextIcon } from "lucide-react";
import {
  Fragment,
  forwardRef,
  memo,
  type ReactElement,
  type ReactNode,
} from "react";
import { SNIPPET_RENDERED } from "storybook/internal/docs-tools";
import type { StoryContext } from "storybook/internal/types";
import {
  addons,
  applyHooks,
  HooksContext,
  mockChannel,
} from "storybook/preview-api";
import { describe, expect, it } from "vitest";
import { jsxSourceOptions } from "../.storybook/jsx-source.ts";

type Render = (args: Record<string, unknown>) => ReactElement;

/** Runs a story through Storybook's own JSX decorator and returns the snippet it emits. */
async function snippet(
  render: Render,
  args: Record<string, unknown> = {},
  jsx: object = jsxSourceOptions,
): Promise<string> {
  const channel = mockChannel();
  addons.setChannel(channel);
  let source: string | undefined;
  channel.on(SNIPPET_RENDERED, (event: { source: string }) => {
    source = event.source;
  });
  const hooks = new HooksContext<ReactRenderer>();
  // The fields the decorator and the hooks read; a story's context has more.
  const context = {
    id: "story",
    args,
    unmappedArgs: args,
    hooks,
    parameters: { __isArgsStory: true, jsx },
    originalStoryFn: render,
  } as unknown as StoryContext<ReactRenderer>;
  const story = applyHooks(applyDecorators)(
    (ctx) => render(ctx.args),
    decorators,
  );
  story(context);
  hooks.triggerEffects();
  await Promise.resolve();
  if (source === undefined) throw new Error("no snippet emitted");
  return source;
}

function Chip(_: {
  icon?: unknown;
  error?: Error;
  focusRequested?: { current: boolean };
  onClick?: () => void;
  items?: unknown[];
  children?: ReactNode;
}) {
  return null;
}

const Group = (_: { children?: ReactNode }) => null;

describe("jsxSourceOptions", () => {
  it("prints a component type by its name", async () => {
    const code = await snippet((args) => <Chip {...args} />, {
      icon: FileTextIcon,
    });
    expect(code).toBe("<Chip icon={FileText} />");
  });

  it("names a memo or forwardRef component through what it wraps", async () => {
    const Inner = forwardRef(function Inner() {
      return null;
    });
    Inner.displayName = "Inner";
    const code = await snippet(() => <Chip icon={memo(Inner)} />);
    expect(code).toBe("<Chip icon={Inner} />");
  });

  it("passes a ref under the prop's name", async () => {
    const code = await snippet((args) => <Chip {...args} />, {
      focusRequested: { current: false },
    });
    expect(code).toBe("<Chip focusRequested={focusRequested} />");
  });

  it("writes an Error as its construction", async () => {
    const code = await snippet((args) => <Chip {...args} />, {
      error: new TypeError('503 "busy"'),
    });
    expect(code).toBe('<Chip error={new TypeError("503 \\"busy\\"")} />');
  });

  it("prints a callback as an empty arrow, never by its name", async () => {
    const code = await snippet((args) => <Chip {...args} />, {
      onClick: function minified() {},
    });
    expect(code).toBe("<Chip onClick={() => {}} />");
  });

  it("rewrites values inside arrays and objects", async () => {
    const code = await snippet((args) => <Chip {...args} />, {
      items: [{ icon: FileTextIcon, label: "Notes" }],
    });
    expect(code).toContain("icon: FileText,");
    expect(code).not.toContain("$$typeof");
  });

  it("inlines a shared fragment in the children it lands in", async () => {
    const shared = (
      <>
        <Chip>a</Chip>
        <Chip>b</Chip>
      </>
    );
    const code = await snippet(() => (
      <Group>
        {shared}
        <Chip>c</Chip>
      </Group>
    ));
    expect(code).not.toContain("Fragment");
    expect(code).toBe(
      [
        "<Group>",
        "  <Chip>",
        "    a",
        "  </Chip>",
        "  <Chip>",
        "    b",
        "  </Chip>",
        "  <Chip>",
        "    c",
        "  </Chip>",
        "</Group>",
      ].join("\n"),
    );
  });

  it("keeps a keyed fragment", async () => {
    const code = await snippet(() => (
      <Group>
        {["a"].map((k) => (
          <Fragment key={k}>
            <Chip />
          </Fragment>
        ))}
      </Group>
    ));
    expect(code).toContain("React.Fragment");
  });

  it("inlines a fragment inside an array of children", async () => {
    const shared = (
      <>
        <Chip>a</Chip>
      </>
    );
    const code = await snippet(() => (
      <Group>
        {[shared]}
        <Chip>b</Chip>
      </Group>
    ));
    expect(code).not.toContain("Fragment");
  });

  it("names a shared ref after each prop it is passed as", async () => {
    const ref = { current: false };
    const code = await snippet(() => <Chip focusRequested={ref} icon={ref} />);
    expect(code).toBe(
      "<Chip\n  focusRequested={focusRequested}\n  icon={icon}\n/>",
    );
  });

  it("writes Component for a name no source could spell", async () => {
    const Inner = forwardRef(() => null);
    Inner.displayName = "ForwardRef(Inner)";
    const code = await snippet(() => <Chip icon={Inner} />);
    expect(code).toBe("<Chip icon={Component} />");
  });

  it("leaves a story's own args and elements untouched", async () => {
    // Production React leaves an element's props unfrozen; this one is too.
    const inner = <Chip icon={FileTextIcon} />;
    const element = { ...inner, props: { ...inner.props } };
    const cyclic: Record<string, unknown> = { element };
    cyclic.self = cyclic;
    const args = {
      focusRequested: { current: false },
      icon: FileTextIcon,
      items: [cyclic],
    };
    const code = await snippet((a) => <Chip {...a} />, args);
    expect(args.focusRequested).toEqual({ current: false });
    expect(args.icon).toBe(FileTextIcon);
    expect(element.props.icon).toBe(FileTextIcon);
    expect(cyclic.self).toBe(cyclic);
    expect(code).toContain("self: '[Circular]'");
    expect(code).not.toContain("$$typeof");
  });

  it("keeps the elements' names, as Storybook's own option gives them", async () => {
    const code = await snippet(() => (
      <div>
        <FileTextIcon />
        <Chip />
      </div>
    ));
    expect(code).toBe(
      ["<div>", "  <FileText />", "  <Chip />", "</div>"].join("\n"),
    );
  });

  it("is what Storybook prints without it, for these values", async () => {
    // Guards the premise: if Storybook ever writes these as source on its
    // own, the option is dead weight.
    const code = await snippet(
      (args) => <Chip {...args} />,
      {
        icon: FileTextIcon,
        focusRequested: { current: false },
      },
      {},
    );
    expect(code).toContain("$$typeof");
    expect(code).toContain("[Circular]");
  });
});
