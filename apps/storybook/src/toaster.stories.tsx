import { Button } from "@orz/ui/components/button";
import { Toaster } from "@orz/ui/components/sonner";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";

const USAGE = `import { Toaster } from "@orz/ui/components/sonner";
import { toast } from "sonner";

// Once, near the app's root, inside ThemeProvider.
<Toaster position="bottom-right" />

// Anywhere below it.
toast("Saved");
toast.success("Published");`;

/**
 * The `<Toaster />` itself is mounted once by the preview decorator. It needs
 * `ThemeProvider` above it (it follows the colour scheme); the preview mounts
 * one globally.
 */
const meta = {
  title: "ui/Primitives/Toaster",
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The controls drive a second `Toaster` of the story's own: with an `id` it
 * shows only toasts sent with that `toasterId`, and the global one only toasts
 * sent without one, so no toast appears twice.
 */
export const Playground: Story = {
  args: {
    position: "bottom-right",
    richColors: false,
    closeButton: false,
    expand: false,
  },
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: (args) => (
    <>
      <Button
        variant="outline"
        onClick={() => toast("Saved", { toasterId: "playground" })}
      >
        Show a toast
      </Button>
      <Toaster {...args} id="playground" />
    </>
  ),
};

// A render that takes no args, on purpose: Storybook then shows the story as
// written, so the snippet prints the `toast.*` and `copyToClipboard` calls,
// which are the usage.
export const Kinds: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast("Saved")}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success("Published")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.info("Synced")}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Unsaved draft")}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.error("Upload failed")}>
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
            loading: "Uploading…",
            success: "Uploaded",
          })
        }
      >
        Loading
      </Button>
      <Button
        variant="outline"
        onClick={() => copyToClipboard("https://app.example/", "Link copied")}
      >
        Copy (clipboard helper)
      </Button>
    </div>
  ),
};
