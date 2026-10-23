import { type ContentRenderer, ContentRenderers } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  type AttachmentViewerProviderProps,
  useStoredImageLook,
} from "@orz/ui-content/attachment";
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";

/** Caps the story's width: `withWidth("max-w-3xl")`. */
export function withWidth(className: string): Decorator {
  return (Story) => (
    <div className={className}>
      <Story />
    </div>
  );
}

/** A fixed height, for a view that fills its parent (the hex views). */
export function withHeight(height: number): Decorator {
  return (Story) => (
    <div style={{ height }}>
      <Story />
    </div>
  );
}

/**
 * Registers `renderers` around the story. Call it at module scope: the array it
 * closes over then stays the same across renders, as ContentRenderers asks.
 */
export function withRenderers(...renderers: ContentRenderer[]): Decorator {
  return (Story) => (
    <ContentRenderers renderers={renderers}>
      <Story />
    </ContentRenderers>
  );
}

export type ViewerOptions = Omit<
  AttachmentViewerProviderProps,
  "children" | "imageLook" | "onImageLookChange"
>;

// One remembered image look for every story with a viewer.
const IMAGE_LOOK_KEY = "orz-storybook-image-look";

function StoredLookViewer({
  children,
  ...options
}: ViewerOptions & { children: ReactNode }) {
  const [imageLook, setImageLook] = useStoredImageLook(IMAGE_LOOK_KEY);
  return (
    <AttachmentViewerProvider
      {...options}
      imageLook={imageLook}
      onImageLookChange={setImageLook}
    >
      {children}
    </AttachmentViewerProvider>
  );
}

/** An attachment viewer around the story; `group` etc. pass through. */
export function withViewer(options: ViewerOptions = {}): Decorator {
  return (Story) => (
    <StoredLookViewer {...options}>
      <Story />
    </StoredLookViewer>
  );
}
