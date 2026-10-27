import { Badge } from "@orz/ui/components/badge";
import { ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { hasPage, loadedPage, pages } from "../pages.ts";
import { BASE, Link, useRouter } from "../router.tsx";
import { storybookHref } from "../routes.ts";

/** A guideline a demo puts into practice. */
export interface DemoGuideline {
  /** The page's route, from the site root (`/guidelines/patterns/overlays/`). */
  route: string;
  title: string;
}

/** The packages a demo is built from, read off the Storybook titles in its `meta.api`. */
const packagesOf = (api: readonly string[] = []) => [
  ...new Set(api.map((title) => title.split("/")[0] ?? "")),
];

/**
 * A demo's page: its title and lead from `meta`, the demo at full width, then the guidelines it
 * shows and its components in Storybook. A demo page is `layout: "bare"`, so it lays itself out.
 */
export function DemoPage({
  guidelines,
  children,
}: {
  guidelines: DemoGuideline[];
  children: ReactNode;
}) {
  const { route } = useRouter();
  const meta = loadedPage(route)?.meta;
  return (
    <div className="mx-auto max-w-screen-2xl px-3 py-6 md:px-6 md:py-8">
      <p className="mb-1 text-muted-foreground text-sm">
        <Link to="/demos/" className="hover:text-foreground">
          Demos
        </Link>
      </p>
      <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
        {meta?.title}
      </h1>
      {meta?.description && (
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {meta.description}
        </p>
      )}
      <div className="mt-6">{children}</div>
      <div className="mt-10 grid gap-4 md:grid-cols-[1fr_auto]">
        <section aria-labelledby="guidelines-shown">
          <h2 id="guidelines-shown" className="mb-2 font-semibold text-lg">
            Guidelines shown here
          </h2>
          <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {guidelines.map(({ route: to, title }) => (
              <li key={to} className="flex min-h-9 items-center">
                {/* A guideline still being written shows as a title until its page lands. */}
                {hasPage(to) ? (
                  <Link
                    to={to}
                    className="font-medium underline underline-offset-4"
                  >
                    {title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        {meta?.api && meta.api.length > 0 && (
          <section
            aria-labelledby="demo-components"
            className="self-start rounded-lg border p-3 text-sm md:w-64"
          >
            <h2 id="demo-components" className="mb-1 font-medium">
              Components
            </h2>
            <ul>
              {meta.api.map((title) => (
                <li key={title}>
                  {/* Several packages export a `Content` page, so a demo names the package too. */}
                  <a
                    href={storybookHref(BASE, title)}
                    className="inline-flex min-h-7 items-center text-muted-foreground hover:text-foreground"
                  >
                    {title.replace(/\/(?:[A-Z]\w*\/)?/, " · ")}
                    <ArrowUpRightIcon className="ml-0.5 size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** A card for each page under /demos/, from its `meta`. */
export function DemoGallery() {
  const demos = pages
    .filter(({ route }) => route.startsWith("/demos/") && route !== "/demos/")
    .sort(
      (a, b) =>
        (a.meta.order ?? Number.POSITIVE_INFINITY) -
          (b.meta.order ?? Number.POSITIVE_INFINITY) ||
        a.meta.title.localeCompare(b.meta.title),
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {demos.map(({ route, meta }) => (
        <Link
          key={route}
          to={route}
          className="flex flex-col gap-2 rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:bg-accent"
        >
          <span className="font-semibold">{meta.title}</span>
          {meta.description && (
            <span className="text-muted-foreground text-sm">
              {meta.description}
            </span>
          )}
          <span className="mt-auto flex flex-wrap gap-1 pt-2">
            {packagesOf(meta.api).map((name) => (
              <Badge key={name} variant="outline" className="font-mono">
                {name}
              </Badge>
            ))}
          </span>
        </Link>
      ))}
    </div>
  );
}
