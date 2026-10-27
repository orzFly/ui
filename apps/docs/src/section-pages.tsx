import { nav } from "./pages.ts";
import { Link } from "./router.tsx";
import { type NavNode, pagesIn, trail } from "./routes.ts";

function PageCard({ node }: { node: NavNode }) {
  return (
    <Link
      to={node.route}
      className="flex min-h-11 flex-col gap-0.5 rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
    >
      <span className="font-medium">{node.title}</span>
      {node.description && (
        <span className="text-muted-foreground text-sm">
          {node.description}
        </span>
      )}
    </Link>
  );
}

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

const grid = "grid gap-3 sm:grid-cols-2";

/**
 * The pages under a route, from the nav, a directory as a heading over its
 * own; so a section's landing page never lists a page by hand.
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
          return (
            <div key={first.route} className={grid}>
              {run.map((child) => (
                <PageCard key={child.route} node={child} />
              ))}
            </div>
          );
        }
        return (
          <section key={first.route}>
            <h3 className="mb-3 font-semibold text-lg tracking-tight">
              {first.title}
            </h3>
            <div className={grid}>
              {pagesIn(first).map((child) => (
                <PageCard key={child.route} node={child} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
