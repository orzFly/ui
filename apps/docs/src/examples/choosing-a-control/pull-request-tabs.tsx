import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { PULL_REQUEST } from "@orz/fixtures/pull-request.ts";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";

const comments = PULL_REQUEST.timeline.filter(
  (event) => event.kind === "comment",
);
const pushes = PULL_REQUEST.timeline.filter((event) => event.kind === "push");

export function PullRequestTabs() {
  return (
    <Tabs defaultValue="conversation" className="min-w-0">
      <TabsList className="max-w-full overflow-x-auto">
        <TabsTrigger value="conversation">Conversation</TabsTrigger>
        <TabsTrigger value="commits">Commits</TabsTrigger>
        <TabsTrigger value="checks">Checks</TabsTrigger>
      </TabsList>
      <TabsContent value="conversation" className="text-sm">
        {comments.length} comments on “{PULL_REQUEST.title}”.
      </TabsContent>
      <TabsContent value="commits" className="text-sm">
        <ul className="grid gap-1">
          {pushes.map((push) => (
            <li key={push.commit}>
              <code>{push.commit}</code> pushed by {push.author}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="checks" className="text-sm">
        <ul className="grid gap-1">
          {CI_RUN.jobs.map((job) => (
            <li key={job.id}>
              {CI_RUN.workflow} / {job.name}: {job.status}
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}
