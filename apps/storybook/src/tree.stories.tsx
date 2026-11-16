import { Input } from "@orz/ui/components/input";
import { NavListFrame } from "@orz/ui/components/nav-list";
import {
  Tree,
  TreeCount,
  TreeItem,
  TreeLabel,
  type TreeRowState,
} from "@orz/ui/components/tree";
import type { TreeNode } from "@orz/ui/lib/tree-rows";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withWidth } from "./decorators.tsx";

interface FileNode extends TreeNode<FileNode> {
  name: string;
}

/** A directory: its id is its path, which the hrefs below use. */
const dir = (path: string, children?: FileNode[]): FileNode => ({
  id: path,
  name: path.split("/").at(-1) ?? path,
  children: children?.map((c) => rebase(c, path)),
});
const file = (name: string): FileNode => ({ id: name, name });

/** Prefixes a subtree's ids with its parent's path. */
function rebase(node: FileNode, parent: string): FileNode {
  const id = `${parent}/${node.name}`;
  return {
    ...node,
    id,
    children: node.children?.map((c) => rebase(c, id)),
  };
}

const FILES: FileNode[] = [
  dir("src", [
    dir("components", [
      file("button.tsx"),
      file("dialog.tsx"),
      file("tree.tsx"),
    ]),
    dir("hooks", [file("use-media-query.ts")]),
    dir("lib", [file("link.ts"), file("utils.ts")]),
    dir("vendor", []),
  ]),
  dir("test", [file("tree.test.tsx")]),
  file("package.json"),
  file("README.md"),
];

const fileRow = (item: FileNode, row: TreeRowState) => (
  <TreeItem href={`#${item.id}`}>
    {!row.branch ? (
      <FileIcon />
    ) : row.expanded ? (
      <FolderOpenIcon />
    ) : (
      <FolderIcon />
    )}
    <TreeLabel>{item.name}</TreeLabel>
    {item.children && item.children.length > 0 && (
      <TreeCount>{item.children.length}</TreeCount>
    )}
  </TreeItem>
);

const FILE_ROW = `{(item, row) => (
    <TreeItem href={\`#\${item.id}\`}>
      {!row.branch ? <FileIcon /> : row.expanded ? <FolderOpenIcon /> : <FolderIcon />}
      <TreeLabel>{item.name}</TreeLabel>
      {item.children?.length > 0 && <TreeCount>{item.children.length}</TreeCount>}
    </TreeItem>
  )}`;

/** The frame an app's pane of places sits in, which raymond draws as a well. */
const withFrame: Decorator = (Story) => (
  <NavListFrame>
    <Story />
  </NavListFrame>
);

// Annotated rather than `satisfies`: a generic component's meta would lose
// its node type, and every render's item with it.
const meta: Meta<typeof Tree<FileNode>> = {
  title: "ui/Primitives/Tree",
  component: Tree,
  parameters: { guidelines: "/guidelines/patterns/navigation/" },
  args: {
    "aria-label": "Files",
    items: FILES,
    current: "src/components/button.tsx",
    defaultExpanded: ["src/lib"],
    currentToken: "page",
    children: fileRow,
  },
  argTypes: {
    currentToken: { control: "inline-radio", options: ["page", "location"] },
  },
  decorators: [withFrame, withWidth("max-w-64")],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Each row is a link. `current` opens the way to the place on screen; a click on a closed
 * folder's name opens it too, and only the toggle or ← closes one.
 */
export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Tree
  aria-label="Files"
  items={files}
  current="src/components/button.tsx"
  defaultExpanded={["src/lib"]}
>
  ${FILE_ROW}
</Tree>`,
      },
    },
  },
};

/**
 * Places held in app state rather than in a URL: each row a `button` through `asChild`, the
 * current one marked as the location in view.
 */
export const Location: Story = {
  args: { currentToken: "location" },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <Tree {...args}>
        {(item, row) => (
          <TreeItem asChild>
            <button
              type="button"
              onClick={() => updateArgs({ current: item.id })}
            >
              {!row.branch ? (
                <FileIcon />
              ) : row.expanded ? (
                <FolderOpenIcon />
              ) : (
                <FolderIcon />
              )}
              <TreeLabel>{item.name}</TreeLabel>
            </button>
          </TreeItem>
        )}
      </Tree>
    );
  },
  parameters: {
    docs: {
      source: {
        code: `<Tree aria-label="Files" items={files} current={current} currentToken="location">
  {(item, row) => (
    <TreeItem asChild>
      <button type="button" onClick={() => setCurrent(item.id)}>
        {!row.branch ? <FileIcon /> : row.expanded ? <FolderOpenIcon /> : <FolderIcon />}
        <TreeLabel>{item.name}</TreeLabel>
      </button>
    </TreeItem>
  )}
</Tree>`,
      },
    },
  },
};

/** The open branches held by the app: `expanded`, and `onExpandedChange` to follow the reader. */
export const Controlled: Story = {
  args: {
    expanded: ["src", "test"],
    onExpandedChange: fn(),
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <Tree
        {...args}
        onExpandedChange={(expanded) => {
          updateArgs({ expanded });
          args.onExpandedChange?.(expanded);
        }}
      />
    );
  },
  parameters: {
    docs: {
      source: {
        code: `<Tree
  aria-label="Files"
  items={files}
  current="src/components/button.tsx"
  expanded={expanded}
  onExpandedChange={setExpanded}
>
  ${FILE_ROW}
</Tree>`,
      },
    },
  },
};

const LAZY: FileNode[] = [
  dir("src", [file("index.ts")]),
  { id: "node_modules", name: "node_modules", hasChildren: true },
  { id: "dist", name: "dist", hasChildren: true },
  file("package.json"),
];

/**
 * Folders marked `hasChildren` with no `children` yet: opening one asks the app for them, and a
 * loading row stands in until they come.
 */
export const Lazy: Story = {
  args: { items: LAZY, current: undefined, defaultExpanded: undefined },
  render: function Render(args) {
    const [items, setItems] = useState(args.items);
    const load = (expanded: string[]) => {
      for (const id of expanded) {
        const node = items.find((n) => n.id === id);
        if (!node?.hasChildren || node.children) continue;
        setTimeout(() => {
          setItems((now) =>
            now.map((n) =>
              n.id === id ? dir(id, [file("index.js"), file("index.d.ts")]) : n,
            ),
          );
        }, 600);
      }
    };
    return <Tree {...args} items={items} onExpandedChange={load} />;
  },
  parameters: {
    docs: {
      source: {
        code: `const [items, setItems] = useState(roots);

<Tree
  aria-label="Files"
  items={items}
  onExpandedChange={(expanded) => {
    for (const id of expanded) {
      const node = find(items, id);
      if (node?.hasChildren && !node.children) {
        fetchChildren(id).then((children) => setItems(withChildren(items, id, children)));
      }
    }
  }}
>
  ${FILE_ROW}
</Tree>`,
      },
    },
  },
};

/**
 * Typing keeps the files whose names hold the text, with the folders on the way to them opened;
 * clearing it brings back the folders as they were.
 */
export const Filter: Story = {
  render: function Render(args) {
    const [text, setText] = useState("");
    const filter = useMemo(() => {
      const needle = text.trim().toLowerCase();
      return needle
        ? (item: FileNode) => item.name.toLowerCase().includes(needle)
        : undefined;
    }, [text]);
    return (
      <div className="flex flex-col gap-2">
        <Input
          aria-label="Filter files"
          placeholder="Filter"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Tree {...args} filter={filter} />
      </div>
    );
  },
  parameters: {
    docs: {
      source: {
        code: `const [text, setText] = useState("");
const filter = text
  ? (item) => item.name.toLowerCase().includes(text.toLowerCase())
  : undefined;

<Input aria-label="Filter files" value={text} onChange={(e) => setText(e.target.value)} />
<Tree aria-label="Files" items={files} filter={filter}>
  ${FILE_ROW}
</Tree>`,
      },
    },
  },
};

/** Ten levels, every one open: the indent and the guides at depth. */
function deep(level: number, path: string): FileNode[] {
  const name = `level-${level}`;
  const id = `${path}/${name}`;
  if (level === 10) return [{ id, name: "leaf.txt" }];
  return [
    { id, name, children: deep(level + 1, id) },
    { id: `${id}.txt`, name: `${name}.txt` },
  ];
}
const DEEP = deep(1, "");

export const Deep: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    items: DEEP,
    current: undefined,
    defaultExpanded: DEEP.flatMap(function ids(n): string[] {
      return n.children ? [n.id, ...n.children.flatMap(ids)] : [];
    }),
  },
};

/** About 2000 rows, all on screen at once. */
const LARGE: FileNode[] = Array.from({ length: 40 }, (_, d) =>
  dir(
    `package-${d + 1}`,
    Array.from({ length: 49 }, (_, f) => file(`module-${f + 1}.ts`)),
  ),
);

export const Large: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    items: LARGE,
    current: "package-20/module-25.ts",
    defaultExpanded: LARGE.map((n) => n.id),
  },
};

export const LongLabels: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    items: [
      dir("a-directory-whose-name-runs-on-well-past-the-width-of-the-pane", [
        file("and-a-file-inside-it-with-a-name-just-as-long-as-its-parent.tsx"),
      ]),
      file("short.ts"),
    ],
    current:
      "a-directory-whose-name-runs-on-well-past-the-width-of-the-pane/and-a-file-inside-it-with-a-name-just-as-long-as-its-parent.tsx",
  },
};
