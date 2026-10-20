import { Button } from "@orz/ui/components/button";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";

/** The `<Toaster />` itself is mounted once by the preview decorator. */
const meta = {
  title: "Components/Toaster",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

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
