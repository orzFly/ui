import { Button } from "@orz/ui/components/button";
import { LoadFailure } from "@orz/ui/components/load-failure";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { FolderPlusIcon } from "lucide-react";
import { useState } from "react";

const RUNS = [
  { name: "build", detail: "Passed in 2m 14s" },
  { name: "test", detail: "Passed in 5m 02s" },
  { name: "deploy", detail: "Waiting for approval" },
];

export function ListStates() {
  const [retrying, setRetrying] = useState(false);
  return (
    <Tabs defaultValue="loading">
      <TabsList>
        <TabsTrigger value="loading">Loading</TabsTrigger>
        <TabsTrigger value="empty">Empty</TabsTrigger>
        <TabsTrigger value="failed">Failed</TabsTrigger>
        <TabsTrigger value="loaded">Loaded</TabsTrigger>
      </TabsList>
      <div className="mt-2 min-h-40 rounded-lg border p-4">
        <TabsContent value="loading" className="grid gap-4">
          {RUNS.map((run) => (
            <div key={run.name} className="grid gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </TabsContent>
        <TabsContent
          value="empty"
          className="flex flex-col items-center justify-center gap-2 py-4 text-center"
        >
          <FolderPlusIcon className="size-6 text-muted-foreground" />
          <p className="font-medium">No pipelines yet</p>
          <p className="text-muted-foreground text-sm">
            A pipeline runs your checks on every push.
          </p>
          <Button variant="outline" className="mt-2">
            New pipeline
          </Button>
        </TabsContent>
        <TabsContent value="failed">
          <LoadFailure
            message="Couldn't load the pipelines."
            detail="503 Service Unavailable"
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              setTimeout(() => setRetrying(false), 800);
            }}
          />
        </TabsContent>
        <TabsContent value="loaded" className="grid gap-4">
          {RUNS.map((run) => (
            <div key={run.name} className="grid gap-0.5">
              <p className="font-medium text-sm">{run.name}</p>
              <p className="text-muted-foreground text-xs">{run.detail}</p>
            </div>
          ))}
        </TabsContent>
      </div>
    </Tabs>
  );
}
