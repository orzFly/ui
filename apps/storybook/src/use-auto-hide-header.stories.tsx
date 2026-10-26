import { useAutoHideHeader } from "@orz/ui/hooks/viewport-chrome";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";

const USAGE = `import { useAutoHideHeader } from "@orz/ui/hooks/viewport-chrome";
import { SM_UP, useMediaQuery } from "@orz/ui/hooks/use-media-query";
import { useRef } from "react";

function Page() {
  const header = useRef<HTMLElement>(null);
  useAutoHideHeader(header, !useMediaQuery(SM_UP));
  return (
    <>
      <header
        ref={header}
        data-header-follow=""
        className="sticky"
        style={{ top: "calc(var(--vv-top, 0px) - var(--header-hide, 0px))" }}
      >
        …
      </header>
      <main>…</main>
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/useAutoHideHeader",
  parameters: {
    layout: "fullscreen",
    // The header is sticky and its offset lands on <html>; drawn inline, it
    // would ride the docs page itself.
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PARAGRAPHS = Array.from({ length: 60 }, (_, i) => i + 1);

/**
 * Scroll down and the header slides away with the page; scroll up and it comes
 * back. Let go half way and it settles fully in or out. Enabled at every width
 * here, so a wheel shows it too; an app enables it on a phone only.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const header = useRef<HTMLElement>(null);
    useAutoHideHeader(header, true);
    return (
      <>
        <header
          ref={header}
          data-header-follow=""
          className="sticky z-10 flex h-14 items-center border-b bg-background px-4 font-medium"
          style={{ top: "calc(var(--vv-top, 0px) - var(--header-hide, 0px))" }}
        >
          Header
        </header>
        <main className="grid gap-2 p-4">
          {PARAGRAPHS.map((n) => (
            <p key={n}>Paragraph {n}</p>
          ))}
        </main>
      </>
    );
  },
};
