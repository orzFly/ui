import {
  LinkCard,
  LinkCardDescription,
  LinkCardTitle,
} from "@orz/ui/components/link-card";
import { nav } from "./pages.ts";
import { Link } from "./router.tsx";
import { type NavNode, pagesIn, trail } from "./routes.ts";

/** Children in nav order, consecutive pages in one run, a directory a run of its own. */
function runs(children: NavNode[]): NavNode[][] {
  const out: NavNode[][] = [];
  for (const child of children) {
    const last = out.at(-1);
    const isGroup = child.children.length > 0;
    if (!isGroup && last && last[0]?.children.length === 0) last.push(child);
    else out.push([child]);
  }
  return out;
}

/** One line per page: its title, then what it says, beside it from sm up. */
function PageList({ nodes }: { nodes: NavNode[] }) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.route}>
          <LinkCard variant="row" asChild>
            <Link to={node.route}>
              <LinkCardTitle>{node.title}</LinkCardTitle>
              {node.description && (
                <LinkCardDescription>{node.description}</LinkCardDescription>
              )}
            </Link>
          </LinkCard>
        </li>
      ))}
    </ul>
  );
}

/**
 * The pages under a route, from the nav, a directory as a heading over its
 * own; so a section's landing page never lists a page by hand. A list rather
 * than cards: the sidebar beside it already holds the same pages, and a list
 * reads their descriptions in one pass.
 */
export function SectionPages({ route }: { route: string }) {
  const node = trail(nav, route).at(-1);
  if (!node) throw new Error(`SectionPages: no page at ${route}`);
  return (
    <div className="my-6 grid gap-8">
      {runs(node.children).map((run) => {
        const [first] = run;
        if (!first) return null;
        if (first.children.length === 0) {
          return <PageList key={first.route} nodes={run} />;
        }
        return (
          <section key={first.route}>
            <h3 className="mb-2 font-semibold text-heading-3 tracking-tight">
              {first.title}
            </h3>
            <PageList nodes={pagesIn(first)} />
          </section>
        );
      })}
    </div>
  );
}
