import {
  moveItem,
  Reorder,
  ReorderButtons,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import { useState } from "react";

const ROUTES = [
  { match: "/api/*", upstream: "api-pool", rule: "Rate limit 100/min" },
  { match: "/static/*", upstream: "cdn", rule: "Cache 1 day" },
  { match: "/admin/*", upstream: "admin", rule: "Sign-in required" },
  { match: "/docs/*", upstream: "docs.example", rule: "Redirect" },
  { match: "/*", upstream: "web", rule: "Everything else" },
];

export function RouteTable() {
  const [routes, setRoutes] = useState(ROUTES);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-0 p-0" />
          <TableHead>Match</TableHead>
          <TableHead>Upstream</TableHead>
          <TableHead>Rule</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Order</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <Reorder
        items={routes.map((r) => r.match)}
        onMove={(move) => setRoutes((rs) => moveItem(rs, move))}
        // The catch-all stays last: it never moves, and nothing goes below it.
        canMove={(id) => id !== "/*"}
        canDrop={(_, to) => to.index < routes.length - 1}
        asChild
      >
        <TableBody>
          {routes.map((route) => (
            <ReorderItem
              key={route.match}
              id={route.match}
              name={route.match}
              asChild
            >
              <TableRow>
                <TableCell className="w-0 p-0">
                  <ReorderHandle />
                </TableCell>
                <TableCell className="font-mono">{route.match}</TableCell>
                <TableCell className="font-mono">{route.upstream}</TableCell>
                <TableCell>{route.rule}</TableCell>
                <TableCell className="w-0">
                  <ReorderButtons />
                </TableCell>
              </TableRow>
            </ReorderItem>
          ))}
        </TableBody>
      </Reorder>
    </Table>
  );
}
