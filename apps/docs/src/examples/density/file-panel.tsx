import { Button } from "@orz/ui/components/button";
import {
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  WrapTextIcon,
} from "lucide-react";

const FILES = [
  { name: "build.log", size: "184 KB" },
  { name: "test-results.xml", size: "36 KB" },
  { name: "coverage.json", size: "1.2 MB" },
];

export function FilePanel() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <span className="flex-1 font-medium text-sm">Artifacts</span>
        <Button variant="ghost" size="icon-sm" aria-label="Wrap lines">
          <WrapTextIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh">
          <RefreshCwIcon />
        </Button>
      </div>
      <ul className="py-1">
        {FILES.map((file) => (
          <li
            key={file.name}
            className="flex min-h-9 items-center gap-2 px-3 text-sm"
          >
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {file.size}
            </span>
            <Button variant="ghost" size="xs">
              <DownloadIcon data-icon="inline-start" /> Download
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 border-t px-3 py-2">
        <Button variant="outline">Keep 7 days</Button>
        <Button>Download all</Button>
      </div>
    </div>
  );
}
