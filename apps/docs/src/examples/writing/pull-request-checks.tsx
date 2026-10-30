import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import { Label } from "@orz/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { Textarea } from "@orz/ui/components/textarea";
import { useState } from "react";

export function PullRequestChecks() {
  const [comment, setComment] = useState("");
  return (
    <Tabs defaultValue="checks" className="gap-4">
      <TabsList>
        <TabsTrigger value="conversation">Conversation</TabsTrigger>
        <TabsTrigger value="checks">Checks</TabsTrigger>
      </TabsList>
      <TabsContent value="conversation">
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setComment("");
          }}
        >
          <Label htmlFor="writing-comment">Comment</Label>
          <Textarea
            id="writing-comment"
            placeholder="Leave a comment in markdown…"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button
            type="submit"
            className="justify-self-end"
            disabled={comment.trim() === ""}
          >
            Comment
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="checks" className="grid gap-3">
        <div>
          <h3 className="font-medium">Some checks were not successful</h3>
          <p className="text-muted-foreground text-ui">
            Merging is blocked until every check passes.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CI_RUN.jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  {CI_RUN.workflow} / {job.name}
                </TableCell>
                <TableCell>
                  {job.status === "failed" ? "Failed" : "Passed"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.duration}s
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}
