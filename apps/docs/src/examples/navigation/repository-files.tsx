import { EmptyState } from "@orz/ui/components/empty-state";
import { FileTree, FileTreeItem } from "@orz/ui/components/file-tree";
import { Input } from "@orz/ui/components/input";
import { NavListFrame } from "@orz/ui/components/nav-list";
import type { FileStatus } from "@orz/ui/lib/file-tree";
import { isPlainClick } from "@orz/ui/lib/link";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

const PATHS = [
  ".github/workflows/ci.yml",
  ".env.local",
  "README.md",
  "package.json",
  "dist/bundle.zip",
  "docs/guide.md",
  "docs/old-guide.md",
  "src/fetch-task.ts",
  "src/retry.ts",
  "src/index.ts",
];

const STATUS: Record<string, FileStatus> = {
  ".env.local": "untracked",
  "dist/": "ignored",
  "docs/old-guide.md": "deleted",
  "src/fetch-task.ts": "modified",
  "src/retry.ts": "added",
};

export function RepositoryFiles() {
  const [current, setCurrent] = useState("src/retry.ts");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = PATHS.filter((path) =>
    path.toLowerCase().includes(needle),
  ).length;
  return (
    <NavListFrame className="max-w-72">
      <nav aria-label="Repository" className="flex flex-col gap-2 py-2">
        <div className="px-2">
          <Input
            aria-label="Filter files"
            placeholder="Filter files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {/* Always there, so the first count is read out as it appears. */}
        <p
          aria-live="polite"
          className="px-3 text-ui-sm text-muted-foreground empty:hidden"
        >
          {needle === ""
            ? null
            : matches === 1
              ? "1 file matches"
              : `${matches} files match`}
        </p>
        {needle !== "" && matches === 0 ? (
          <EmptyState icon={SearchIcon} title="No files match" />
        ) : (
          <FileTree
            aria-label="Files"
            paths={PATHS}
            status={STATUS}
            current={current}
            query={query}
          >
            {(file) => (
              <FileTreeItem
                href={`#${file.path}`}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  setCurrent(file.path);
                }}
              />
            )}
          </FileTree>
        )}
      </nav>
    </NavListFrame>
  );
}
