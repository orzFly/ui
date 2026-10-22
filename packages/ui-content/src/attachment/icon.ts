import {
  AppWindowIcon,
  FileArchiveIcon,
  FileHeadphoneIcon,
  FileIcon,
  FilePlayIcon,
  FileTextIcon,
  ImageIcon,
} from "lucide-react";
import {
  type FileLike,
  isArchiveFile,
  isAudioFile,
  isHtmlFile,
  isImageFile,
  isTextFile,
  isVideoFile,
} from "../file-kind.ts";

/**
 * One table behind every attachment icon on the page — list rows, link chips,
 * document cards — so a file cannot wear two hats in one viewport.
 *
 * The three binary kinds are tested last, after the three that were here
 * first: only files that fall through to `FileIcon` today can move. `.ts` is
 * why that ordering is load-bearing rather than merely cautious — it is a
 * TypeScript source and an MPEG transport stream, and `isTextFile` has to get
 * the first look at it.
 */
export function fileIcon(file: FileLike) {
  if (isImageFile(file)) return ImageIcon;
  if (isHtmlFile(file)) return AppWindowIcon;
  if (isTextFile(file)) return FileTextIcon;
  if (isArchiveFile(file)) return FileArchiveIcon;
  // `FileHeadphone` and `FilePlay` are lucide's current names for the audio
  // and video file glyphs; `FileAudio` and `FileVideo` still import, as
  // aliases, but render under the new names — which is what the class in the
  // DOM says, and what the tests therefore have to match.
  if (isAudioFile(file)) return FileHeadphoneIcon;
  if (isVideoFile(file)) return FilePlayIcon;
  return FileIcon;
}
