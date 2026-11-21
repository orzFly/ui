import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ModuleGrid,
} from "@orz/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";

const FIGURES = [
  { label: "Open", value: "38" },
  { label: "Closed this week", value: "112" },
  { label: "Waiting on review", value: "9" },
  { label: "Oldest open", value: "41 days" },
];

const QUEUES = [
  { name: "Inbox", open: 14, oldest: "3 days" },
  { name: "Billing", open: 11, oldest: "41 days" },
  { name: "Releases", open: 8, oldest: "6 days" },
  { name: "Docs", open: 5, oldest: "12 days" },
];

export function ModuleRegion() {
  return (
    <ModuleGrid>
      <ModuleGrid className="grid-cols-2 md:grid-cols-4">
        {FIGURES.map((figure) => (
          <Card key={figure.label} size="sm">
            <CardContent>
              <div className="text-muted-foreground">{figure.label}</div>
              <div className="font-bold text-lg tabular-nums">
                {figure.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </ModuleGrid>
      <ModuleGrid className="lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Card>
          <CardHeader>
            <CardTitle>Queues</CardTitle>
            <CardDescription>By open cards</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Oldest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {QUEUES.map((queue) => (
                  <TableRow key={queue.name}>
                    <TableCell>{queue.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {queue.open}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {queue.oldest}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <ModuleGrid>
          <Card>
            <CardHeader>
              <CardTitle>On call</CardTitle>
            </CardHeader>
            <CardContent>alice until Friday, then bob.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next release</CardTitle>
            </CardHeader>
            <CardContent>Thursday, with 6 cards ready.</CardContent>
          </Card>
        </ModuleGrid>
      </ModuleGrid>
    </ModuleGrid>
  );
}
