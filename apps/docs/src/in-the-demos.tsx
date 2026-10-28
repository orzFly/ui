import type { TocEntry } from "./page.ts";
import { demosShowing } from "./pages.ts";
import { Link } from "./router.tsx";

const ID = "in-the-demos";
const HEADING = "In the demos";

/** The "On this page" entry for the section `InTheDemos` adds, when it adds one. */
export function inTheDemosToc(route: string): TocEntry[] {
  return demosShowing(route).length > 0
    ? [{ depth: 2, id: ID, text: HEADING }]
    : [];
}

/**
 * The demos that put a guideline page into practice, read off their `meta.guidelines`, each
 * with the sentence that says where to look.
 */
export function InTheDemos({ route }: { route: string }) {
  const demos = demosShowing(route);
  if (demos.length === 0) return null;
  return (
    // The demo pages answer for their own words; here they would turn a search for "archive" into a guideline.
    <section aria-labelledby={ID} data-pagefind-ignore>
      <h2
        id={ID}
        className="mt-12 mb-4 scroll-mt-[calc(5rem+env(safe-area-inset-top))] border-b pb-2 font-semibold text-2xl tracking-tight"
      >
        {HEADING}
      </h2>
      <ul className="grid gap-3">
        {demos.map(({ route: demo, meta, where }) => (
          <li key={demo}>
            <Link
              to={demo}
              className="flex flex-col gap-1 rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
            >
              <span className="font-medium">{meta.title}</span>
              <span className="text-muted-foreground text-sm leading-6">
                {where}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
