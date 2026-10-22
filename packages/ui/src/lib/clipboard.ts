import { toast } from "sonner";

/**
 * Copy and say so. The success message names what was copied — the caller
 * knows that; the failure one does not, because every failure here is the
 * same one: no clipboard to write to. Resolves to whether the copy worked,
 * so a caller can offer a fallback such as selecting the text.
 */
export async function copyToClipboard(
  text: string,
  ok: string,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
    return true;
  } catch {
    toast.error("Clipboard is unavailable in this browser");
    return false;
  }
}
