import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { cn } from "@orz/ui/lib/utils";
import { logContent } from "@orz/ui-ansi";
import { asciinemaContent } from "@orz/ui-asciinema";
import { codeContent, patchContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { hexContent } from "@orz/ui-hex/content";
import {
  CircleDotIcon,
  CodeIcon,
  FolderGit2Icon,
  GitPullRequestArrowIcon,
  type LucideIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { Commits, FilesChanged } from "./changes.tsx";
import { Checks } from "./checks.tsx";
import { Conversation } from "./conversation.tsx";
import { PANE, StatusIcon, UserAvatar } from "./parts.tsx";
import {
  CI_RUN,
  COMMITS,
  PULL_REQUEST,
  PULL_REQUEST_ME,
  type PullRequestEvent,
  STATS,
} from "./run.ts";

// In the order the registry tries them: a log before codeContent, which would
// take it as plain text, and hexContent last, for whatever binary is left.
const RENDERERS = [
  logContent,
  asciinemaContent,
  patchContent,
  codeContent,
  hexContent,
];

type Section = "code" | "issues" | "pulls" | "actions" | "settings";

const SECTIONS: {
  id: Section;
  label: string;
  icon: LucideIcon;
  count?: number;
}[] = [
  { id: "code", label: "Code", icon: CodeIcon },
  {
    id: "issues",
    label: "Issues",
    icon: CircleDotIcon,
    count: PULL_REQUEST.openIssues,
  },
  {
    id: "pulls",
    label: "Pull requests",
    icon: GitPullRequestArrowIcon,
    count: PULL_REQUEST.openPulls,
  },
  { id: "actions", label: "Actions", icon: PlayIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function AppBar() {
  const { owner, name } = PULL_REQUEST.repo;
  return (
    <header className="flex h-12 items-center gap-2 border-b px-3 md:px-4">
      <FolderGit2Icon className="size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 truncate">
        <span className="text-muted-foreground">{owner}</span>
        <span className="px-1 text-muted-foreground">/</span>
        <span className="font-semibold">{name}</span>
      </p>
      <p className="ml-auto flex items-center gap-2 text-muted-foreground text-ui">
        <span className="sr-only">Signed in as</span>
        <span className="max-sm:hidden">{PULL_REQUEST_ME}</span>
        <UserAvatar login={PULL_REQUEST_ME} size="default" />
      </p>
    </header>
  );
}

function RepoNav({
  current,
  onSelect,
}: {
  current: Section;
  onSelect(section: Section): void;
}) {
  return (
    <nav aria-label="Repository" className="border-b">
      <ul className="flex overflow-x-auto px-1 md:px-2">
        {SECTIONS.map(({ id, label, icon: Icon, count }) => (
          <li key={id} className="shrink-0">
            <button
              type="button"
              aria-current={id === current ? "page" : undefined}
              onClick={() => onSelect(id)}
              className={cn(
                "flex h-10 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-muted-foreground text-ui transition-colors hover:text-foreground touch:h-11",
                id === current && "border-primary font-medium text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
              {count !== undefined && (
                <Badge variant="secondary" className="tabular-nums">
                  {count}
                </Badge>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** What a repository tab outside the demo shows: what would be there, and the way back. */
function NotInDemo({
  section,
  onBack,
}: {
  section: (typeof SECTIONS)[number];
  onBack(): void;
}) {
  const Icon = section.icon;
  return (
    <div className="grid flex-1 place-content-center justify-items-center gap-3 px-4 py-16 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <h2 className="font-semibold text-lg">
        {section.label} is not part of this demo
      </h2>
      <p className="max-w-sm text-muted-foreground text-ui">
        The demo is one pull request: its conversation, its commits, the CI run
        on it and the files it changes.
      </p>
      <Button variant="outline" onClick={onBack}>
        Open pull request #{PULL_REQUEST.number}
      </Button>
    </div>
  );
}

function PullRequestHeader() {
  return (
    <header className="grid gap-2">
      <h2 className="font-semibold text-xl leading-snug md:text-2xl">
        {PULL_REQUEST.title}{" "}
        <span className="font-normal text-muted-foreground">
          #{PULL_REQUEST.number}
        </span>
      </h2>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-ui">
        <Badge variant="success">
          <GitPullRequestArrowIcon />
          Open
        </Badge>
        <span>
          <span className="font-medium text-foreground">
            {PULL_REQUEST.author}
          </span>{" "}
          wants to merge {COMMITS.length} commits into{" "}
          <code className="rounded bg-muted px-1 font-mono text-ui-sm">
            {PULL_REQUEST.base}
          </code>{" "}
          from{" "}
          <code className="rounded bg-muted px-1 font-mono text-ui-sm">
            {PULL_REQUEST.head}
          </code>
        </span>
      </p>
    </header>
  );
}

function Count({ children }: { children: number }) {
  return (
    <Badge variant="secondary" className="tabular-nums">
      {children}
    </Badge>
  );
}

/**
 * A pull request in a code-hosting app, as one screen of it: the conversation, the commits, the
 * CI run with its logs, recording and artifacts, and the changed files. Every file is a
 * `ContentSource`, and `Content` picks the package that draws it.
 */
export function PullRequest() {
  const [section, setSection] = useState<Section>("pulls");
  const [tab, setTab] = useState("conversation");
  // The failed job first: it is why anyone opens a run.
  const [job, setJob] = useState(
    () => CI_RUN.jobs.find((each) => each.status === "failed")?.id ?? "",
  );
  const [timeline, setTimeline] = useState<PullRequestEvent[]>(
    PULL_REQUEST.timeline,
  );
  const comments = timeline.filter((event) => event.kind === "comment").length;
  const openJob = (id: string) => {
    setJob(id);
    setTab("checks");
  };
  const other = SECTIONS.find((each) => each.id === section);
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <div className="flex min-h-full flex-col bg-background text-foreground">
          <AppBar />
          <RepoNav current={section} onSelect={setSection} />
          {section !== "pulls" && other ? (
            <NotInDemo section={other} onBack={() => setSection("pulls")} />
          ) : (
            <div className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 content-start gap-4 p-3 md:p-6">
              <PullRequestHeader />
              <Tabs
                value={tab}
                onValueChange={setTab}
                style={PANE}
                className="min-w-0 gap-4"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-2">
                  <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="conversation">
                      Conversation <Count>{comments}</Count>
                    </TabsTrigger>
                    <TabsTrigger value="commits">
                      Commits <Count>{COMMITS.length}</Count>
                    </TabsTrigger>
                    <TabsTrigger value="checks">
                      Checks <StatusIcon status={CI_RUN.status} />
                    </TabsTrigger>
                    <TabsTrigger value="files">
                      Files changed <Count>{STATS.files}</Count>
                    </TabsTrigger>
                  </TabsList>
                  <p className="ml-auto font-mono text-ui-sm tabular-nums max-sm:hidden">
                    <span className="diff-addition-text">+{STATS.plus}</span>{" "}
                    <span className="diff-deletion-text">−{STATS.minus}</span>
                  </p>
                </div>
                <TabsContent value="conversation" className="min-w-0">
                  <Conversation
                    timeline={timeline}
                    onJob={openJob}
                    onPost={(body) =>
                      setTimeline((events) => [
                        ...events,
                        {
                          kind: "comment",
                          author: PULL_REQUEST_ME,
                          at: new Date().toISOString(),
                          body,
                        },
                      ])
                    }
                  />
                </TabsContent>
                <TabsContent value="commits" className="min-w-0">
                  <Commits />
                </TabsContent>
                <TabsContent value="checks" className="min-w-0">
                  <Checks job={job} onJob={setJob} />
                </TabsContent>
                <TabsContent value="files" className="min-w-0">
                  <FilesChanged />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}
