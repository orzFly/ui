import {
  AppWindowIcon,
  FileArchiveIcon,
  FileBracesIcon,
  FileCodeIcon,
  FileCogIcon,
  FileIcon,
  FileKeyIcon,
  FileLockIcon,
  FileTextIcon,
  FileTypeIcon,
  ImageIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  type FileNode,
  fileMatcher,
  fileStatuses,
  fileStem,
  fileTreeNodes,
  fileTypeIcon,
  movePath,
  normalizePath,
  resolveFileRow,
} from "../src/lib/file-tree.ts";

/** The tree as indented lines, a merged row's segments joined by " / ". */
const outline = (nodes: readonly FileNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.segments.join(" / ")}${node.directory ? "/" : ""}`,
    ...outline(node.children ?? [], depth + 1),
  ]);

describe("normalizePath", () => {
  it("drops leading slashes, ./ and repeated slashes, keeping a trailing one", () => {
    expect(normalizePath("/a//b")).toBe("a/b");
    expect(normalizePath("./a/b")).toBe("a/b");
    expect(normalizePath("a/./b/")).toBe("a/b/");
  });

  it("is undefined for an empty path", () => {
    expect(normalizePath("")).toBeUndefined();
    expect(normalizePath("/")).toBeUndefined();
    expect(normalizePath("./")).toBeUndefined();
  });
});

describe("fileTreeNodes", () => {
  it("builds folders from the paths, skipping empty and repeated ones", () => {
    const nodes = fileTreeNodes(["src/a.ts", "./src/a.ts", "", "/src//b.ts"]);
    expect(outline(nodes)).toEqual(["src/", "  a.ts", "  b.ts"]);
    expect(nodes[0]).toMatchObject({
      id: "src/",
      path: "src/",
      directory: true,
    });
    expect(nodes[0]?.children?.[0]).toMatchObject({
      id: "src/a.ts",
      name: "a.ts",
      segments: ["a.ts"],
      directory: false,
    });
  });

  it("lists an empty folder written with a trailing slash", () => {
    const nodes = fileTreeNodes(["scripts/", "a.ts"]);
    expect(outline(nodes)).toEqual(["scripts/", "a.ts"]);
    expect(nodes[0]?.children).toEqual([]);
  });

  it("keeps a file and a folder of one name apart", () => {
    const nodes = fileTreeNodes(["x", "x/y"]);
    expect(nodes.map((n) => n.id)).toEqual(["x/", "x"]);
  });

  it("puts folders first, then names in natural order, in any case", () => {
    const nodes = fileTreeNodes(["file10", "File2", "b/x", "a.md", "Z/x"]);
    expect(outline(nodes, 0).filter((l) => !l.startsWith(" "))).toEqual([
      "b/",
      "Z/",
      "a.md",
      "File2",
      "file10",
    ]);
  });

  it("keeps the order given with sort: false", () => {
    const nodes = fileTreeNodes(["b", "a/x", "c"], { sort: false });
    expect(nodes.map((n) => n.id)).toEqual(["b", "a/", "c"]);
  });

  it("sorts siblings with the comparator given", () => {
    const nodes = fileTreeNodes(["a", "b", "c"], {
      sort: (x, y) => y.name.localeCompare(x.name),
    });
    expect(nodes.map((n) => n.id)).toEqual(["c", "b", "a"]);
  });

  it("merges a chain of lone folders into one row, named for the deepest", () => {
    const nodes = fileTreeNodes([
      "test/fixtures/media/clip.webm",
      "test/fixtures/media/tone.ogg",
      "src/a.ts",
    ]);
    expect(outline(nodes)).toEqual([
      "src/",
      "  a.ts",
      "test / fixtures / media/",
      "  clip.webm",
      "  tone.ogg",
    ]);
    expect(nodes[1]).toMatchObject({
      id: "test/fixtures/media/",
      path: "test/fixtures/media/",
      name: "media",
      segments: ["test", "fixtures", "media"],
    });
  });

  it("stops merging at a file, at two children and at an empty folder", () => {
    expect(outline(fileTreeNodes(["a/b/c.ts"]))).toEqual(["a / b/", "  c.ts"]);
    expect(outline(fileTreeNodes(["a/b/x", "a/c/y"]))).toEqual([
      "a/",
      "  b/",
      "    x",
      "  c/",
      "    y",
    ]);
    expect(outline(fileTreeNodes(["a/b/"]))).toEqual(["a / b/"]);
    expect(outline(fileTreeNodes(["a/b/c/", "a/b/d.ts"]))).toEqual([
      "a / b/",
      "  c/",
      "  d.ts",
    ]);
  });

  it("merges nothing with flatten: false", () => {
    expect(outline(fileTreeNodes(["a/b/c.ts"], { flatten: false }))).toEqual([
      "a/",
      "  b/",
      "    c.ts",
    ]);
  });

  it("builds a few thousand paths quickly", () => {
    const paths = Array.from(
      { length: 3000 },
      (_, i) => `pkg${i % 10}/src/dir${i % 97}/file${i}.ts`,
    );
    const start = performance.now();
    fileTreeNodes(paths);
    // A rough guard, loose enough for a slow CI runner.
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe("resolveFileRow", () => {
  const nodes = fileTreeNodes([
    ".github/workflows/ci.yml",
    "src/a.ts",
    "x",
    "x/",
  ]);

  it("finds a file's own row, and a folder's with or without its slash", () => {
    expect(resolveFileRow(nodes, "src/a.ts")).toBe("src/a.ts");
    expect(resolveFileRow(nodes, "src")).toBe("src/");
    expect(resolveFileRow(nodes, "./src/")).toBe("src/");
  });

  it("finds the merged row for a folder it took in", () => {
    expect(resolveFileRow(nodes, ".github/")).toBe(".github/workflows/");
    expect(resolveFileRow(nodes, ".github/workflows")).toBe(
      ".github/workflows/",
    );
  });

  it("tells a file from the folder of the same name", () => {
    expect(resolveFileRow(nodes, "x")).toBe("x");
    expect(resolveFileRow(nodes, "x/")).toBe("x/");
  });

  it("is undefined for a path the tree does not hold", () => {
    expect(resolveFileRow(nodes, "missing")).toBeUndefined();
    expect(resolveFileRow(nodes, "")).toBeUndefined();
  });
});

describe("fileStatuses", () => {
  const nodes = fileTreeNodes([
    "src/a.ts",
    "src/b.ts",
    "docs/guide.md",
    "dist/bundle.zip",
    "dist/keep.txt",
    "test/fixtures/media/clip.webm",
    "README.md",
  ]);

  it("shows a file's own status, and a folder holding one as changes", () => {
    const shown = fileStatuses(nodes, {
      "src/a.ts": "modified",
      "README.md": "added",
    });
    expect(Object.fromEntries(shown)).toEqual({
      "src/": "changes",
      "src/a.ts": "modified",
      "README.md": "added",
    });
  });

  it("passes ignored down a folder, without making its parent changed", () => {
    const shown = fileStatuses(nodes, {
      "dist/": "ignored",
      "dist/keep.txt": "modified",
    });
    expect(shown.get("dist/")).toBe("ignored");
    expect(shown.get("dist/bundle.zip")).toBe("ignored");
    expect(shown.get("dist/keep.txt")).toBe("modified");
    expect(fileStatuses(nodes, { "dist/bundle.zip": "ignored" }).size).toBe(1);
  });

  it("reads a status on a merged folder as the merged row's", () => {
    const shown = fileStatuses(nodes, {
      "test/fixtures/media/clip.webm": "deleted",
    });
    expect(shown.get("test/fixtures/media/")).toBe("changes");
    const ignored = fileStatuses(nodes, { "test/": "ignored" });
    expect(ignored.get("test/fixtures/media/")).toBe("ignored");
    expect(ignored.get("test/fixtures/media/clip.webm")).toBe("ignored");
  });

  it("leaves out a path the tree does not hold", () => {
    expect(fileStatuses(nodes, { "gone.ts": "deleted" }).size).toBe(0);
  });
});

describe("fileTypeIcon", () => {
  it.each([
    ["logo.svg", ImageIcon],
    ["demo.html", AppWindowIcon],
    ["bundle.tar.gz", FileArchiveIcon],
    ["retry.ts", FileCodeIcon],
    ["flags.json", FileBracesIcon],
    ["README.md", FileTextIcon],
    ["LICENSE", FileTextIcon],
    ["ci.yml", FileCogIcon],
    [".gitignore", FileCogIcon],
    ["pnpm-lock.yaml", FileLockIcon],
    ["Cargo.lock", FileLockIcon],
    [".env", FileKeyIcon],
    [".env.local", FileKeyIcon],
    ["paper.pdf", FileIcon],
    ["Makefile.unknown", FileIcon],
  ])("draws %s", (name, icon) => {
    expect(fileTypeIcon(name)).toBe(icon);
  });

  it("tries the longest extension first", () => {
    expect(fileTypeIcon("index.d.ts")).toBe(FileTypeIcon);
    expect(fileTypeIcon("index.ts")).toBe(FileCodeIcon);
  });

  it("ignores case", () => {
    expect(fileTypeIcon("README.MD")).toBe(FileTextIcon);
    expect(fileTypeIcon("PACKAGE.JSON")).toBe(FileBracesIcon);
  });
});

describe("fileMatcher", () => {
  const [src] = fileTreeNodes([
    "packages/client/index.ts",
    "packages/client/x.ts",
  ]);

  it("matches the path, trimmed, in any case", () => {
    const match = fileMatcher("  CLIENT/ ");
    expect(match && src && match(src)).toBe(true);
    expect(fileMatcher("nope")?.(src as FileNode)).toBe(false);
  });

  it("is undefined for a blank query", () => {
    expect(fileMatcher("")).toBeUndefined();
    expect(fileMatcher("   ")).toBeUndefined();
  });
});

describe("movePath", () => {
  it("moves the file itself", () => {
    expect(movePath("a/b.ts", "a/b.ts", "c/b.ts")).toBe("c/b.ts");
    expect(movePath("a/b.ts", "a/b.ts", "b.ts")).toBe("b.ts");
  });

  it("moves a folder and every path under it", () => {
    expect(movePath("a/x/", "a/x/", "b/x/")).toBe("b/x/");
    expect(movePath("a/x/y.ts", "a/x/", "b/x/")).toBe("b/x/y.ts");
  });

  it("leaves a path not under the folder as it is", () => {
    expect(movePath("a/xy.ts", "a/x/", "b/x/")).toBe("a/xy.ts");
    expect(movePath("a/x", "a/x/", "b/x/")).toBe("a/x");
    expect(movePath("c/d.ts", "a/b.ts", "c/b.ts")).toBe("c/d.ts");
  });

  it("applies a group's pairs one after another", () => {
    // A selected folder's moves carry the files in it; a FileTree hands
    // no pair for them.
    const moves = [
      ["a/x/", "c/x/"],
      ["b.ts", "c/b.ts"],
    ] as const;
    const apply = (path: string) =>
      moves.reduce((p, [from, to]) => movePath(p, from, to), path);
    expect(["a/x/", "a/x/y.ts", "b.ts", "a/z.ts"].map(apply)).toEqual([
      "c/x/",
      "c/x/y.ts",
      "c/b.ts",
      "a/z.ts",
    ]);
  });
});

describe("fileStem", () => {
  it("ends before the last dot, or at the end with none or only a leading one", () => {
    expect(fileStem("button.tsx")).toBe(6);
    expect(fileStem(".gitignore")).toBe(10);
    expect(fileStem("archive.tar.gz")).toBe(11);
    expect(fileStem("Makefile")).toBe(8);
  });
});
