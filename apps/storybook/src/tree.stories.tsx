import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@orz/ui/components/dropdown-menu";
import { MatchedText } from "@orz/ui/components/filter-menu";
import { Input } from "@orz/ui/components/input";
import { NavListFrame } from "@orz/ui/components/nav-list";
import {
  Tree,
  TreeCount,
  TreeItem,
  TreeLabel,
  type TreeRowState,
} from "@orz/ui/components/tree";
import { moveNodes, type TreeNode } from "@orz/ui/lib/tree-rows";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withScroller, withWidth } from "./decorators.tsx";

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
    virtualize: { control: "inline-radio", options: ["auto", true, false] },
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

/**
 * `filterMode` keeps every row while filtering: `expand` opens the folders on the way to each
 * match on top of the reader's own, `collapse` opens only those. A row's `match` says it
 * matches, here drawn with `MatchedText`. The reader opens and closes folders for the search
 * alone, and clearing it brings back the folders as they were.
 */
export const FilterMode: Story = {
  args: { filterMode: "expand" },
  argTypes: {
    filterMode: {
      control: "inline-radio",
      options: ["hide", "expand", "collapse"],
    },
  },
  render: function Render(args) {
    const [text, setText] = useState("utils");
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
        <Tree {...args} filter={filter}>
          {(item, row) => (
            <TreeItem href={`#${item.id}`}>
              {!row.branch ? (
                <FileIcon />
              ) : row.expanded ? (
                <FolderOpenIcon />
              ) : (
                <FolderIcon />
              )}
              <TreeLabel>
                {row.match ? (
                  <MatchedText text={item.name} query={text.trim()} />
                ) : (
                  item.name
                )}
              </TreeLabel>
            </TreeItem>
          )}
        </Tree>
      </div>
    );
  },
  parameters: {
    docs: {
      source: {
        code: `const [text, setText] = useState("utils");
// A new function is a new search: memoize it.
const filter = useMemo(
  () => (text ? (item) => item.name.toLowerCase().includes(text.toLowerCase()) : undefined),
  [text],
);

<Input aria-label="Filter files" value={text} onChange={(e) => setText(e.target.value)} />
<Tree aria-label="Files" items={files} filter={filter} filterMode="expand">
  {(item, row) => (
    <TreeItem href={\`#\${item.id}\`}>
      {!row.branch ? <FileIcon /> : row.expanded ? <FolderOpenIcon /> : <FolderIcon />}
      <TreeLabel>
        {row.match ? <MatchedText text={item.name} query={text} /> : item.name}
      </TreeLabel>
    </TreeItem>
  )}
</Tree>`,
      },
    },
  },
};

/** About 2000 rows: 40 folders of 49 files. */
const LARGE: FileNode[] = Array.from({ length: 40 }, (_, d) =>
  dir(
    `package-${d + 1}`,
    Array.from({ length: 49 }, (_, f) => file(`module-${f + 1}.ts`)),
  ),
);

/**
 * Only the rows near the screen are mounted, the rest standing as empty space in the scroller:
 * `virtualize` turns it on or off, and by default a tree turns it on past a few hundred rows. The
 * current place, scrolled into sight, and the row with the focus stay mounted wherever they are.
 */
export const Virtualize: Story = {
  args: {
    items: LARGE,
    current: "package-20/module-25.ts",
    defaultExpanded: LARGE.map((n) => n.id),
    virtualize: true,
  },
  decorators: [withScroller(320)],
  parameters: {
    docs: {
      source: {
        code: `<div className="h-80 overflow-y-auto">
  <Tree
    aria-label="Files"
    items={packages}
    current="package-20/module-25.ts"
    defaultExpanded={packages.map((p) => p.id)}
    virtualize
  >
    ${FILE_ROW}
  </Tree>
</div>`,
      },
    },
  },
};

/** Three packages, three parts in each, three modules in each part, six files in each module. */
const NESTED: FileNode[] = ["app", "core", "plugins"].map((pkg) =>
  dir(
    pkg,
    ["src", "test", "docs"].map((part) =>
      dir(
        part,
        ["alpha", "beta", "gamma"].map((mod) =>
          dir(
            mod,
            Array.from({ length: 6 }, (_, f) => file(`${mod}-${f + 1}.ts`)),
          ),
        ),
      ),
    ),
  ),
);

const allBranches = (nodes: readonly FileNode[]): string[] =>
  nodes.flatMap((n) => (n.children ? [n.id, ...allBranches(n.children)] : []));

/**
 * `stickyBranches` keeps the folders above the rows on screen at the top of the scroller, one
 * under the other, so the reader always sees which folder the rows belong to; the next folder
 * pushes the last one out. A pin's toggle closes its folder and leaves it under the pointer.
 */
export const StickyBranches: Story = {
  args: {
    items: NESTED,
    current: undefined,
    defaultExpanded: allBranches(NESTED),
    stickyBranches: true,
  },
  decorators: [withScroller(320)],
  parameters: {
    docs: {
      source: {
        code: `<div className="h-80 overflow-y-auto">
  <Tree aria-label="Files" items={files} defaultExpanded={folders} stickyBranches>
    ${FILE_ROW}
  </Tree>
</div>`,
      },
    },
  },
};

/** The tree with node `id` given by `change`, or taken out where it returns nothing. */
function edit(
  nodes: readonly FileNode[],
  id: string,
  change: (node: FileNode) => FileNode | undefined,
): FileNode[] {
  return nodes.flatMap((node) => {
    if (node.id === id) return change(node) ?? [];
    return node.children
      ? [{ ...node, children: edit(node.children, id, change) }]
      : [node];
  });
}

/** The tree with `item` taken from its place and put where `target` says. */
/**
 * F2 on the focused row, or a call to `handle.rename`, opens a field over its name. Enter or
 * leaving the field gives the name to `onRename`, which changes the items; Escape puts it back.
 * `validateName` says why a name will not do.
 */
export const Rename: Story = {
  args: {
    onRename: fn(),
    validateName: (_, name) =>
      name.includes("/") ? "A name cannot contain “/”." : undefined,
  },
  render: function Render(args) {
    const [items, setItems] = useState(args.items);
    return (
      <Tree
        {...args}
        items={items}
        onRename={(item, name) => {
          setItems((now) => edit(now, item.id, (n) => ({ ...n, name })));
          args.onRename?.(item, name);
        }}
      />
    );
  },
};

const OUTLINE: FileNode[] = [
  file("Introduction"),
  dir("Getting started", [file("Install"), file("First steps")]),
  dir("Guides", [file("Forms"), file("Tables"), file("Navigation")]),
  file("Changelog"),
];

/**
 * A tree the reader orders by hand: a row dragged onto another goes before it, into it or after
 * it by the pointer's height, and `onMove` puts it there, which `moveNodes` does for plain
 * objects. Ctrl+X and Ctrl+V move the focused row without a pointer.
 */
export const Move: Story = {
  args: {
    "aria-label": "Outline",
    items: OUTLINE,
    current: undefined,
    defaultExpanded: ["Getting started", "Guides"],
    onMove: fn(),
  },
  render: function Render(args) {
    const [items, setItems] = useState(args.items);
    return (
      <Tree
        {...args}
        items={items}
        onMove={(moved, target) => {
          setItems((now) => moveNodes(now, moved, target));
          args.onMove?.(moved, target);
        }}
      />
    );
  },
  parameters: {
    docs: {
      source: {
        code: `const [items, setItems] = useState(outline);

<Tree
  aria-label="Outline"
  items={items}
  defaultExpanded={["Getting started", "Guides"]}
  onMove={(moved, target) => setItems((now) => moveNodes(now, moved, target))}
>
  ${FILE_ROW}
</Tree>`,
      },
    },
  },
};

/**
 * `menu` draws a ⋯ button at the end of the current row, the focused one and the one under the
 * pointer, and of every row on a touch screen; Shift+F10 opens it on the focused row. A right
 * click stays the link's.
 */
export const Menu: Story = {
  args: { onRename: fn(), onMove: fn() },
  render: function Render(args) {
    const [items, setItems] = useState(args.items);
    return (
      <Tree
        {...args}
        items={items}
        onRename={(item, name) => {
          setItems((now) => edit(now, item.id, (n) => ({ ...n, name })));
          args.onRename?.(item, name);
        }}
        onMove={(moved, target) => {
          setItems((now) => moveNodes(now, moved, target));
          args.onMove?.(moved, target);
        }}
        menu={(item, actions) => (
          <>
            <DropdownMenuItem
              disabled={!actions.rename}
              onSelect={actions.rename}
            >
              Rename
              <DropdownMenuShortcut>F2</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!actions.cut} onSelect={actions.cut}>
              Cut
              <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!actions.paste}
              onSelect={actions.paste}
            >
              Paste
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                setItems((now) => edit(now, item.id, () => undefined))
              }
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      />
    );
  },
};

/**
 * `selectable`: the pointer on a row's icon draws a checkbox there, and a click on it selects the
 * row; Space toggles the focused row and Shift with the arrows extends from it. Dragging a
 * selected row takes the whole selection along, and so do Ctrl+X and the row's menu, whose
 * Select is how a touch screen starts.
 */
export const Selection: Story = {
  args: {
    "aria-label": "Outline",
    items: OUTLINE,
    current: undefined,
    defaultExpanded: ["Getting started", "Guides"],
    selectable: true,
    selected: ["Guides/Forms", "Guides/Tables"],
    onSelectedChange: fn(),
    onMove: fn(),
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [items, setItems] = useState(args.items);
    return (
      <Tree
        {...args}
        items={items}
        onSelectedChange={(selected) => {
          updateArgs({ selected });
          args.onSelectedChange?.(selected);
        }}
        onMove={(moved, target) => {
          setItems((now) => moveNodes(now, moved, target));
          args.onMove?.(moved, target);
        }}
        menu={(_, actions) => (
          <>
            {actions.select && (
              <DropdownMenuItem onSelect={actions.select}>
                Select
                <DropdownMenuShortcut>Space</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            {actions.deselect && (
              <DropdownMenuItem onSelect={actions.deselect}>
                Deselect
                <DropdownMenuShortcut>Space</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            {actions.clearSelection && (
              <DropdownMenuItem onSelect={actions.clearSelection}>
                Clear selection
                <DropdownMenuShortcut>Esc</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!actions.cut} onSelect={actions.cut}>
              {actions.items.length > 1
                ? `Cut ${actions.items.length} items`
                : "Cut"}
              <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!actions.paste}
              onSelect={actions.paste}
            >
              Paste
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
      />
    );
  },
  parameters: {
    docs: {
      source: {
        code: `const [items, setItems] = useState(outline);
const [selected, setSelected] = useState(["Guides/Forms", "Guides/Tables"]);

<Tree
  aria-label="Outline"
  items={items}
  defaultExpanded={["Getting started", "Guides"]}
  selectable
  selected={selected}
  onSelectedChange={setSelected}
  onMove={(moved, target) => setItems((now) => moveNodes(now, moved, target))}
  menu={(item, actions) => (
    <>
      {actions.select && <DropdownMenuItem onSelect={actions.select}>Select</DropdownMenuItem>}
      {actions.deselect && <DropdownMenuItem onSelect={actions.deselect}>Deselect</DropdownMenuItem>}
      {actions.clearSelection && (
        <DropdownMenuItem onSelect={actions.clearSelection}>Clear selection</DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!actions.cut} onSelect={actions.cut}>
        {actions.items.length > 1 ? \`Cut \${actions.items.length} items\` : "Cut"}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!actions.paste} onSelect={actions.paste}>Paste</DropdownMenuItem>
    </>
  )}
>
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

/** About 2000 rows in a box that scrolls, virtualized as `"auto"` has it. */
export const Large: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    items: LARGE,
    current: "package-20/module-25.ts",
    defaultExpanded: LARGE.map((n) => n.id),
  },
  decorators: [withScroller(480)],
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
