import { FileTree, FileTreeItem } from "@orz/ui/components/file-tree";
import { Input } from "@orz/ui/components/input";
import { NavListFrame } from "@orz/ui/components/nav-list";
import type { FileStatus } from "@orz/ui/lib/file-tree";
import { isPlainClick } from "@orz/ui/lib/link";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { argsUpdater } from "./args.ts";
import { withScroller, withWidth } from "./decorators.tsx";

const PATHS = [
  ".github/workflows/ci.yml",
  ".env.local",
  ".gitignore",
  "LICENSE",
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "config/deploy.json",
  "config/flags.json",
  "dist/bundle.zip",
  "docs/assets/logo.svg",
  "docs/assets/sprite.png",
  "docs/appendix.md",
  "docs/guide.md",
  "docs/old-guide.md",
  "docs/paper.pdf",
  "packages/client/src/fetch-task.ts",
  "packages/client/src/index.ts",
  "packages/client/src/retry.ts",
  "packages/client/src/types.d.ts",
  "packages/client/test/retry.test.ts",
  "packages/client/package.json",
  "scripts/",
  "test/fixtures/media/clip.webm",
  "test/fixtures/media/tone.ogg",
];

const STATUS: Record<string, FileStatus> = {
  ".env.local": "untracked",
  "dist/": "ignored",
  "docs/old-guide.md": "deleted",
  "packages/client/src/fetch-task.ts": "modified",
  "packages/client/src/retry.ts": "added",
  "packages/client/test/retry.test.ts": "renamed",
  "README.md": "modified",
};

/** The frame an app's pane of files sits in, which raymond draws as a well. */
const withFrame: Decorator = (Story) => (
  <NavListFrame>
    <Story />
  </NavListFrame>
);

const ROW = `{(file) => <FileTreeItem href={\`#\${file.path}\`} />}`;

const meta = {
  title: "ui/FileTree",
  component: FileTree,
  parameters: { guidelines: "/guidelines/patterns/navigation/" },
  args: {
    "aria-label": "Files",
    paths: PATHS,
    current: "packages/client/src/retry.ts",
    children: () => null,
  },
  argTypes: {
    filterMode: {
      control: "inline-radio",
      options: ["hide", "expand", "collapse"],
    },
    virtualize: { control: "inline-radio", options: ["auto", true, false] },
    children: { control: false },
  },
  decorators: [withFrame, withWidth("max-w-72")],
  // Each row a link to its path; a plain click also makes it the current file.
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <FileTree {...args}>
        {(file) => (
          <FileTreeItem
            href={`#${file.path}`}
            onClick={(event) => {
              if (isPlainClick(event)) updateArgs({ current: file.path });
            }}
          />
        )}
      </FileTree>
    );
  },
} satisfies Meta<typeof FileTree>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Paths in, a tree out: folders first in natural order, each row a link with its file type's
 * icon. `current` opens the way to the file on screen.
 */
export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: `<FileTree aria-label="Files" paths={paths} current="packages/client/src/retry.ts">
  ${ROW}
</FileTree>`,
      },
    },
  },
};

/**
 * `status` by path: a letter at the row's end and the name in the status's colour, a dot on a
 * folder holding a change, and an ignored folder's files faded with it.
 */
export const Status: Story = {
  args: {
    status: STATUS,
    defaultExpanded: ["docs", "packages/client/test", "dist"],
  },
  parameters: {
    docs: {
      source: {
        code: `<FileTree
  aria-label="Files"
  paths={paths}
  current="packages/client/src/retry.ts"
  status={{
    "packages/client/src/retry.ts": "added",
    "packages/client/src/fetch-task.ts": "modified",
    "docs/old-guide.md": "deleted",
    ".env.local": "untracked",
    "dist/": "ignored",
  }}
>
  ${ROW}
</FileTree>`,
      },
    },
  },
};

/** `flatten: false` keeps a row per folder where the default merges a chain of lone ones. */
export const Flatten: Story = {
  args: {
    flatten: false,
    defaultExpanded: [".github", "test", "test/fixtures"],
  },
  parameters: {
    docs: {
      source: {
        code: `<FileTree aria-label="Files" paths={paths} flatten={false}>
  ${ROW}
</FileTree>`,
      },
    },
  },
};

/**
 * `query` filters by path, the matching text marked; `filterMode` says what becomes of the rest:
 * `hide` leaves the matches and their folders, `expand` keeps every row and opens the folders on
 * the way to a match, `collapse` opens only those.
 */
export const Search: Story = {
  args: { query: "retry", filterMode: "hide", status: STATUS },
  render: function Render(args) {
    const [query, setQuery] = useState(args.query ?? "");
    useEffect(() => setQuery(args.query ?? ""), [args.query]);
    return (
      <div className="flex flex-col gap-2">
        <Input
          aria-label="Filter files"
          placeholder="Filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <FileTree {...args} query={query}>
          {(file) => <FileTreeItem href={`#${file.path}`} />}
        </FileTree>
      </div>
    );
  },
  parameters: {
    docs: {
      source: {
        code: `const [query, setQuery] = useState("retry");

<Input aria-label="Filter files" value={query} onChange={(e) => setQuery(e.target.value)} />
<FileTree aria-label="Files" paths={paths} query={query} filterMode="hide">
  ${ROW}
</FileTree>`,
      },
    },
  },
};

/**
 * A router's link through `asChild`: the row draws its icon, name and status inside the link
 * the router renders.
 */
export const RouterLink: Story = {
  args: { status: STATUS },
  render: function Render(args) {
    return (
      <FileTree {...args}>
        {(file) => (
          <FileTreeItem asChild>
            {/* biome-ignore lint/a11y/useAnchorContent: FileTreeItem draws the icon, name and status inside it */}
            <a href={`#/repo/${file.path}`} />
          </FileTreeItem>
        )}
      </FileTree>
    );
  },
  parameters: {
    docs: {
      source: {
        code: `<FileTree aria-label="Files" paths={paths} current={path} status={status}>
  {(file) => (
    <FileTreeItem asChild>
      <Link to="/repo/$" params={{ _splat: file.path }} />
    </FileTreeItem>
  )}
</FileTree>`,
      },
    },
  },
};

/** About 3000 files in 60 folders, every folder open. */
const LARGE = Array.from(
  { length: 3000 },
  (_, i) =>
    `packages/package-${(i % 12) + 1}/src/module-${(i % 5) + 1}/file-${i + 1}.ts`,
);
const LARGE_OPEN = [
  "packages/",
  ...Array.from({ length: 12 }, (_, p) => [
    `packages/package-${p + 1}/src/`,
    ...Array.from(
      { length: 5 },
      (_, m) => `packages/package-${p + 1}/src/module-${m + 1}/`,
    ),
  ]).flat(),
];

/**
 * `stickyBranches` keeps the folders above the rows on screen at the top of the scroller, so the
 * reader always sees which folder the files belong to; the next folder pushes the last one out.
 */
export const StickyBranches: Story = {
  args: {
    paths: LARGE,
    current: undefined,
    defaultExpanded: LARGE_OPEN,
    stickyBranches: true,
  },
  decorators: [withScroller(320)],
  parameters: {
    docs: {
      source: {
        code: `<div className="h-80 overflow-y-auto">
  <FileTree aria-label="Files" paths={paths} defaultExpanded={folders} stickyBranches>
    ${ROW}
  </FileTree>
</div>`,
      },
    },
  },
};

export const Large: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    paths: LARGE,
    current: "packages/package-6/src/module-3/file-1498.ts",
    defaultExpanded: LARGE_OPEN,
  },
  decorators: [withScroller(480)],
};

export const LongNames: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    paths: [
      "a-folder-whose-name-runs-on-well-past-the-width-of-the-pane/another-folder-just-as-long-inside-it/and-a-file-with-a-name-just-as-long-as-its-parents.tsx",
      "short.ts",
    ],
    status: {
      "a-folder-whose-name-runs-on-well-past-the-width-of-the-pane/another-folder-just-as-long-inside-it/and-a-file-with-a-name-just-as-long-as-its-parents.tsx":
        "modified",
    },
    current:
      "a-folder-whose-name-runs-on-well-past-the-width-of-the-pane/another-folder-just-as-long-inside-it/and-a-file-with-a-name-just-as-long-as-its-parents.tsx",
  },
};

/** Twelve folders deep, with a sibling at each level so none merge. */
export const DeepPath: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    paths: Array.from({ length: 12 }, (_, level) => {
      const folder = Array.from(
        { length: level + 1 },
        (_, k) => `level-${k + 1}`,
      ).join("/");
      return `${folder}/notes-${level + 1}.md`;
    }),
    current:
      "level-1/level-2/level-3/level-4/level-5/level-6/level-7/level-8/level-9/level-10/level-11/level-12/notes-12.md",
  },
};

export const SingleFile: Story = {
  tags: ["edge", "!autodocs"],
  args: { paths: ["README.md"], current: undefined },
};
