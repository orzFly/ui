import { codeContent, patchContent } from "@orz/ui-code";
import {
  attachmentCard,
  audioContent,
  htmlContent,
  imageContent,
  pdfContent,
  videoContent,
} from "@orz/ui-content/attachment";
import { markdownContent } from "@orz/ui-markdown";

/**
 * Every renderer an attachment surface needs, in the order the registry tries them. A module
 * constant, so `withRenderers(...ATTACHMENT_RENDERERS)` hands ContentRenderers one stable list.
 */
export const ATTACHMENT_RENDERERS = [
  attachmentCard(),
  imageContent(),
  htmlContent(),
  pdfContent(),
  videoContent(),
  audioContent(),
  markdownContent(),
  patchContent,
  codeContent,
];
