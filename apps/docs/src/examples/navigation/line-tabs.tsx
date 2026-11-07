import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";

export function LineTabs() {
  return (
    <Tabs defaultValue="summary" className="text-ui">
      <TabsList variant="line">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
      </TabsList>
      <TabsContent value="summary">
        {CI_RUN.jobs.length} jobs ran on this push.
      </TabsContent>
      <TabsContent value="jobs">
        <ul className="grid gap-1">
          {CI_RUN.jobs.map((job) => (
            <li key={job.id}>
              {job.name}: {job.status}
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}
