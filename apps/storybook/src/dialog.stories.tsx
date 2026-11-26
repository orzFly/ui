import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleBar,
  DialogTrigger,
} from "@orz/ui/components/dialog";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { Pane } from "@orz/ui/components/pane";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fn } from "storybook/test";

const meta = {
  title: "ui/Primitives/Dialog",
  component: Dialog,
  parameters: { guidelines: "/guidelines/patterns/overlays/" },
  args: { onOpenChange: fn() },
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Rename</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            The slug changes with the name; old links keep working.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dialog-name">Name</Label>
          <Input id="dialog-name" defaultValue="orzui" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const FooterCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A footer close button</DialogTitle>
          <DialogDescription>
            The footer's own close button comes from `showCloseButton`.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
};

export const NoCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No corner button</DialogTitle>
          <DialogDescription>
            Escape or the overlay closes it.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};

export const TitleBarCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitleBar>
          <DialogTitle className="min-w-0 flex-1 truncate">
            report.pdf
          </DialogTitle>
          <Button variant="ghost" size="sm">
            Download
          </Button>
          <DialogCloseButton />
        </DialogTitleBar>
        <DialogDescription>
          The X is the last control of the title row, sharing its centre and
          right edge, instead of pinned to the corner.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  ),
};

export const ScrollingBody: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Long content</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changelog</DialogTitle>
          <DialogDescription>
            The body scrolls; the title and the footer stay.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {Array.from({ length: 40 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static filler rows
            <p key={i}>Entry {i + 1}</p>
          ))}
        </DialogBody>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
};

const CONTAINER = `// \`pip\` is the window documentPictureInPicture.requestWindow() resolved
// to, with the page's stylesheets copied in; this part of the page is
// rendered into its body with createPortal.
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Rename</Button>
  </DialogTrigger>
  <DialogContent container={pip.document.body}>
    <DialogHeader>
      <DialogTitle>Rename project</DialogTitle>
    </DialogHeader>
    <div className="grid gap-2">
      <Label htmlFor="name">Name</Label>
      <Input id="name" defaultValue="orzui" />
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`;

/**
 * Opens in another window's document: here a frame, standing in for a
 * Picture-in-Picture window, which the trigger is rendered into.
 */
export const Container: Story = {
  parameters: { docs: { source: { code: CONTAINER, language: "tsx" } } },
  render: function Render(args) {
    const [frame, setFrame] = useState<Document | null>(null);
    useEffect(() => {
      if (frame === null) return;
      // A new window has none of the page's styles. Copied in as a
      // Picture-in-Picture window's are, and kept in step, so the frame
      // follows the toolbar's theme and style; a link is cloned once rather
      // than replaced, which would flash the frame unstyled while it loads.
      const clones = new Map<Element, Element>();
      const mirror = () => {
        const sources = [
          ...document.head.querySelectorAll("style, link[rel=stylesheet]"),
        ];
        for (const [source, clone] of clones) {
          if (sources.includes(source)) continue;
          clone.remove();
          clones.delete(source);
        }
        for (const source of sources) {
          const clone = clones.get(source);
          if (clone === undefined) {
            const copy = source.cloneNode(true) as Element;
            clones.set(source, copy);
            frame.head.append(copy);
          } else if (clone.textContent !== source.textContent) {
            clone.textContent = source.textContent;
          }
        }
        const root = frame.documentElement;
        for (const name of root.getAttributeNames()) root.removeAttribute(name);
        for (const { name, value } of document.documentElement.attributes)
          root.setAttribute(name, value);
      };
      mirror();
      let pending = 0;
      const observer = new MutationObserver(() => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(mirror);
      });
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      observer.observe(document.documentElement, { attributes: true });
      return () => {
        observer.disconnect();
        cancelAnimationFrame(pending);
      };
    }, [frame]);
    return (
      <>
        <Pane purpose="window" asChild>
          <iframe
            title="Another window"
            srcDoc="<!doctype html><title>Another window</title>"
            className="h-80 w-full"
            onLoad={(event) => setFrame(event.currentTarget.contentDocument)}
          />
        </Pane>
        {frame !== null &&
          createPortal(
            <Dialog {...args}>
              <DialogTrigger asChild>
                <Button variant="outline" className="m-4">
                  Rename
                </Button>
              </DialogTrigger>
              <DialogContent container={frame.body}>
                <DialogHeader>
                  <DialogTitle>Rename project</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="frame-name">Name</Label>
                  <Input id="frame-name" defaultValue="orzui" />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>,
            frame.body,
          )}
      </>
    );
  },
};
