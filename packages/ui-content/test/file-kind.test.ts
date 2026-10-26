import { describe, expect, it } from "vitest";
import {
  formatSize,
  isArchiveFile,
  isAudioFile,
  isHtmlFile,
  isImageFile,
  isMarkdownFile,
  isPatchFile,
  isPdfFile,
  isTextEmbed,
  isTextFile,
  isVideoFile,
  TEXT_PREVIEW_HARD_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  textPreviewGate,
} from "../src/index.ts";

const file = (name: string, mime: string) => ({ name, mime });

describe("isImageFile", () => {
  it("trusts an image/* content type", () => {
    expect(isImageFile(file("shot.png", "image/png"))).toBe(true);
    expect(isImageFile(file("weird.bin", "image/webp"))).toBe(true);
  });

  it("falls back to the filename for typeless uploads", () => {
    expect(isImageFile(file("shot.png", "application/octet-stream"))).toBe(
      true,
    );
    expect(isImageFile(file("shot.JPG", ""))).toBe(true);
    expect(isImageFile({ name: "shot.png" })).toBe(true);
  });

  it("never previews non-images", () => {
    expect(isImageFile(file("notes.txt", "text/plain"))).toBe(false);
    expect(isImageFile(file("archive.zip", "application/octet-stream"))).toBe(
      false,
    );
    // a real (non-generic) content type wins over the extension
    expect(isImageFile(file("fake.png", "text/plain"))).toBe(false);
  });
});

describe("isTextFile", () => {
  it("trusts text/* and text-shaped application types", () => {
    expect(isTextFile(file("notes.txt", "text/plain"))).toBe(true);
    expect(isTextFile(file("report.md", "text/markdown"))).toBe(true);
    expect(isTextFile(file("data.json", "application/json"))).toBe(true);
  });

  it("falls back to the filename for generic types (CLI code uploads)", () => {
    expect(isTextFile(file("main.rs", "application/octet-stream"))).toBe(true);
    expect(isTextFile(file("build.log", ""))).toBe(true);
    expect(isTextFile(file("archive.zip", "application/octet-stream"))).toBe(
      false,
    );
  });

  it("does not let the extension override a real binary type", () => {
    expect(isTextFile(file("fake.txt", "application/zip"))).toBe(false);
  });
});

describe("isTextEmbed", () => {
  it("embeds text files, and leaves images to the image renderer", () => {
    expect(isTextEmbed({ name: "notes.md" })).toBe(true);
    // An svg is both; the image wins.
    expect(isTextEmbed({ name: "logo.svg" })).toBe(false);
    expect(isTextEmbed({ name: "shot.png" })).toBe(false);
  });
});

describe("isMarkdownFile", () => {
  it("matches by content type or extension", () => {
    expect(isMarkdownFile(file("report.md", ""))).toBe(true);
    expect(isMarkdownFile(file("REPORT.MARKDOWN", "text/plain"))).toBe(true);
    expect(isMarkdownFile(file("notes", "text/markdown"))).toBe(true);
    expect(isMarkdownFile(file("notes.txt", "text/plain"))).toBe(false);
  });
});

describe("isPatchFile", () => {
  it("trusts the declared diff types, whatever the name", () => {
    expect(isPatchFile(file("fix", "text/x-patch"))).toBe(true);
    expect(isPatchFile(file("fix.txt", "text/x-diff"))).toBe(true);
  });

  it("falls back to .patch/.diff only for generic types", () => {
    expect(isPatchFile(file("fix.patch", "application/octet-stream"))).toBe(
      true,
    );
    expect(isPatchFile(file("FIX.DIFF", ""))).toBe(true);
    // A declared type outranks the name, as it does for every other kind.
    expect(isPatchFile(file("fix.patch", "text/plain"))).toBe(false);
    expect(isPatchFile(file("diff.txt", ""))).toBe(false);
  });
});

describe("isHtmlFile", () => {
  it("matches by content type or extension", () => {
    expect(isHtmlFile(file("demo.html", "text/html"))).toBe(true);
    expect(isHtmlFile(file("page", "application/xhtml+xml"))).toBe(true);
    expect(isHtmlFile(file("demo.htm", "application/octet-stream"))).toBe(true);
    // A real non-HTML type wins over the extension.
    expect(isHtmlFile(file("fake.html", "application/zip"))).toBe(false);
  });
});

describe("isPdfFile", () => {
  it("trusts a declared application/pdf", () => {
    expect(isPdfFile(file("paper.pdf", "application/pdf"))).toBe(true);
    expect(isPdfFile(file("paper", "application/pdf"))).toBe(true);
  });

  it("falls back to the filename for generic types", () => {
    expect(isPdfFile(file("paper.pdf", "application/octet-stream"))).toBe(true);
    expect(isPdfFile(file("PAPER.PDF", ""))).toBe(true);
  });

  it("does not let the extension override a declared type", () => {
    expect(isPdfFile(file("paper.pdf", "text/plain"))).toBe(false);
  });
});

describe("isArchiveFile / isAudioFile / isVideoFile (T-401)", () => {
  it("trusts a declared archive, audio or video type", () => {
    expect(isArchiveFile(file("bundle.zip", "application/zip"))).toBe(true);
    expect(isArchiveFile(file("src.tgz", "application/gzip"))).toBe(true);
    expect(isArchiveFile(file("old.rar", "application/vnd.rar"))).toBe(true);
    expect(isAudioFile(file("take.m4a", "audio/mp4"))).toBe(true);
    expect(isVideoFile(file("clip.mp4", "video/mp4"))).toBe(true);
  });

  it("falls back to the filename for generic types (CLI uploads)", () => {
    expect(isArchiveFile(file("bundle.zip", "application/octet-stream"))).toBe(
      true,
    );
    expect(isArchiveFile(file("dump.7z", ""))).toBe(true);
    expect(isAudioFile(file("take.flac", "application/octet-stream"))).toBe(
      true,
    );
    expect(isVideoFile(file("clip.mp4", "application/octet-stream"))).toBe(
      true,
    );
    expect(isVideoFile(file("CLIP.MOV", ""))).toBe(true);
  });

  it("does not let the extension override a declared type", () => {
    // Same file, mislabelled: every predicate defers, and the declared
    // type is what decides — the gate the extension tables sit behind.
    const mislabelled = file("clip.mp4", "text/plain");
    expect(isVideoFile(mislabelled)).toBe(false);
    expect(isAudioFile(mislabelled)).toBe(false);
    expect(isArchiveFile(mislabelled)).toBe(false);
    expect(isTextFile(mislabelled)).toBe(true);
    expect(isArchiveFile(file("fake.zip", "text/plain"))).toBe(false);
  });

  it("leaves the files the older tiers already claimed alone", () => {
    for (const f of [
      file("shot.png", "image/png"),
      file("demo.html", "text/html"),
      file("main.rs", "application/octet-stream"),
      file("notes.md", ""),
      // TypeScript source, not MPEG transport stream.
      file("index.ts", "application/octet-stream"),
    ]) {
      expect(isArchiveFile(f)).toBe(false);
      expect(isAudioFile(f)).toBe(false);
      expect(isVideoFile(f)).toBe(false);
    }
    expect(isImageFile(file("shot.png", "image/png"))).toBe(true);
    expect(isHtmlFile(file("demo.html", "text/html"))).toBe(true);
    expect(isTextFile(file("index.ts", "application/octet-stream"))).toBe(true);
  });
});

describe("formatSize", () => {
  it("prints bytes, then one decimal below ten units, then whole units", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(20 * 1024)).toBe("20 KB");
    expect(formatSize(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatSize(5 * 1024 ** 4)).toBe("5120 GB");
  });
});

describe("declared types", () => {
  it("are read without parameters and case", () => {
    expect(isHtmlFile(file("page", "Text/HTML; charset=utf-8"))).toBe(true);
    expect(isMarkdownFile(file("notes", "text/markdown; charset=utf-8"))).toBe(
      true,
    );
    expect(isImageFile(file("shot", "IMAGE/PNG"))).toBe(true);
    expect(isTextFile(file("data", "application/json; charset=utf-8"))).toBe(
      true,
    );
    // Still generic once its parameters are gone.
    expect(isImageFile(file("shot.png", "application/octet-stream; x=1"))).toBe(
      true,
    );
  });
});

describe("textPreviewGate", () => {
  const gate = (name: string, mime: string, size: number) =>
    textPreviewGate({ name, mime, size });

  it("previews up to the limit, asks past it", () => {
    expect(gate("edge.log", "text/plain", TEXT_PREVIEW_MAX_BYTES)).toBe("auto");
    expect(gate("huge.log", "text/plain", TEXT_PREVIEW_MAX_BYTES + 1)).toBe(
      "ask",
    );
    expect(gate("notes.md", "text/markdown", TEXT_PREVIEW_MAX_BYTES + 1)).toBe(
      "ask",
    );
  });

  it("never previews past the hard limit", () => {
    expect(gate("edge.log", "text/plain", TEXT_PREVIEW_HARD_MAX_BYTES)).toBe(
      "ask",
    );
    expect(
      gate("huge.log", "text/plain", TEXT_PREVIEW_HARD_MAX_BYTES + 1),
    ).toBe("refuse");
    expect(
      gate("huge.patch", "text/x-patch", TEXT_PREVIEW_HARD_MAX_BYTES + 1),
    ).toBe("refuse");
  });

  it("lets a patch through without asking, up to the hard limit", () => {
    expect(gate("big.patch", "text/x-patch", TEXT_PREVIEW_HARD_MAX_BYTES)).toBe(
      "auto",
    );
    expect(
      gate("big.diff", "application/octet-stream", TEXT_PREVIEW_MAX_BYTES + 1),
    ).toBe("auto");
  });

  it("takes its limits from the caller", () => {
    const limits = { max: 10, hardMax: 20 };
    expect(textPreviewGate({ name: "a.txt", size: 10 }, limits)).toBe("auto");
    expect(textPreviewGate({ name: "a.txt", size: 11 }, limits)).toBe("ask");
    expect(textPreviewGate({ name: "a.txt", size: 21 }, limits)).toBe("refuse");
  });
});
