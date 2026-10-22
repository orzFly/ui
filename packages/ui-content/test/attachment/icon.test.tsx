import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fileIcon } from "../../src/attachment/index.ts";

/**
 * Name, declared type, and the icon the table owes it. The audio and video
 * glyphs are `file-headphone` and `file-play` in lucide's current naming;
 * `FileAudio` and `FileVideo` are aliases of them.
 */
const FILES = [
  ["shot.png", "image/png", "lucide-image"],
  ["logo.svg", "", "lucide-image"],
  ["demo.html", "text/html", "lucide-app-window"],
  ["notes.txt", "text/plain", "lucide-file-text"],
  // TypeScript source, not MPEG transport stream.
  ["index.ts", "application/octet-stream", "lucide-file-text"],
  ["bundle.zip", "application/zip", "lucide-file-archive"],
  ["take.mp3", "audio/mpeg", "lucide-file-headphone"],
  ["clip.mp4", "video/mp4", "lucide-file-play"],
  ["paper.pdf", "application/pdf", "lucide-file"],
  ["blob.bin", "application/octet-stream", "lucide-file"],
] as const;

/**
 * lucide writes the icon's identity into a class of its own. Read it off
 * `classList` rather than the joined string: `lucide-file-archive` contains
 * `lucide-file`, so a substring test would accept the fallback icon.
 */
const identityOf = (icon: Element | null) =>
  [...(icon?.classList ?? [])].find(
    (c) => c.startsWith("lucide-") && c !== "lucide-icon",
  ) ?? null;

describe("fileIcon", () => {
  it.each(FILES)("draws %s (%s) as %s", (name, mime, identity) => {
    const Icon = fileIcon({ name, mime });
    const { container } = render(<Icon />);
    expect(identityOf(container.querySelector("svg"))).toBe(identity);
  });
});
