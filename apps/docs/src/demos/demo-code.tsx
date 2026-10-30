import { Button } from "@orz/ui/components/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { cn } from "@orz/ui/lib/utils";
import { CodeBlock } from "@orz/ui-code";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type DemoFile, loadDemoFiles } from "./demo-source.ts";

const GROUPS: { group: DemoFile["group"]; title: (dir: string) => string }[] = [
  { group: "demo", title: (dir) => `demos/${dir}` },
  { group: "fixtures", title: () => "@orz/fixtures" },
];

/** A file's name under its group's heading. */
const shortName = (file: DemoFile) =>
  file.group === "fixtures"
    ? file.name.replace(/^@orz\/fixtures\//, "")
    : file.name;

const lineCount = (contents: string) => contents.trimEnd().split("\n").length;

/**
 * A demo's files beside the one picked: a list past md, a Select on a phone. The files load when
 * the view first opens; `source` names the one shown, the first when it names none of them.
 */
export function DemoCode({
  dir,
  source,
  onSource,
}: {
  dir: string;
  source: string | null;
  onSource: (name: string) => void;
}) {
  const [files, setFiles] = useState<DemoFile[]>();
  useEffect(() => {
    let live = true;
    void loadDemoFiles(dir).then((loaded) => live && setFiles(loaded));
    return () => {
      live = false;
    };
  }, [dir]);

  if (files === undefined) {
    return (
      <p className="p-4 text-muted-foreground text-ui" role="status">
        Loading the source…
      </p>
    );
  }
  const file = files.find(({ name }) => name === source) ?? files[0];
  if (file === undefined) return null;
  const path = file.group === "demo" ? `demos/${dir}/${file.name}` : file.name;
  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label="Files"
        className="hidden w-60 shrink-0 overflow-y-auto border-r bg-sidebar p-2 text-ui md:block"
      >
        {GROUPS.map(({ group, title }) => {
          const members = files.filter((each) => each.group === group);
          if (members.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="mt-2 mb-1 px-2 font-medium text-muted-foreground text-ui-sm tracking-wide">
                {title(dir)}
              </h3>
              <ul>
                {members.map((each) => (
                  <li key={each.name}>
                    <button
                      type="button"
                      aria-current={each === file ? "true" : undefined}
                      onClick={() => onSource(each.name)}
                      className="flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground touch:min-h-11"
                    >
                      <span className="truncate">{shortName(each)}</span>
                      <span className="text-muted-foreground text-ui-sm tabular-nums">
                        {lineCount(each.contents)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-2 md:px-4">
          <Select value={file.name} onValueChange={onSource}>
            <SelectTrigger
              aria-label="File"
              className="min-w-0 flex-1 font-mono md:hidden"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map(({ group, title }) => {
                const members = files.filter((each) => each.group === group);
                if (members.length === 0) return null;
                return (
                  <SelectGroup key={group}>
                    <SelectLabel>{title(dir)}</SelectLabel>
                    {members.map((each) => (
                      <SelectItem key={each.name} value={each.name}>
                        {shortName(each)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
          <span className="hidden truncate font-mono text-ui md:inline">
            {path}
          </span>
          <span className="hidden shrink-0 text-muted-foreground text-ui md:inline">
            {lineCount(file.contents)} lines
          </span>
          <CopyButton
            key={file.name}
            contents={file.contents}
            className="ml-auto"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <CodeBlock
            filename={path}
            contents={file.contents}
            lineNumbers
            copy={false}
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  contents,
  className,
}: {
  contents: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={() =>
        void navigator.clipboard.writeText(contents).then(() => setCopied(true))
      }
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
