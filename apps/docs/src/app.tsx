import { Toaster } from "@orz/ui/components/sonner";
import { cn } from "@orz/ui/lib/utils";
import { type ReactNode, useEffect } from "react";
import { documentTitle } from "./head.ts";
import { ClientOnly } from "./hydrated.tsx";
import { InTheDemos } from "./in-the-demos.tsx";
import {
  PageContents,
  PageFooter,
  Sidebar,
  SiteHeader,
  Toc,
} from "./layout.tsx";
import { mdxComponents } from "./mdx.tsx";
import { loadedPage, nav } from "./pages.ts";
import { Link, useRouter } from "./router.tsx";
import { trail } from "./routes.ts";

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl py-16 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] md:px-10">
      <h1 className="font-semibold text-3xl tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        Nothing lives at this address.{" "}
        <Link to="/" className="text-foreground underline underline-offset-4">
          Go to the home page
        </Link>
        .
      </p>
    </main>
  );
}

export function App() {
  const { route } = useRouter();
  const page = loadedPage(route);
  const meta = page?.meta;

  useEffect(() => {
    document.title = documentTitle(meta);
  }, [meta]);

  const chain = trail(nav, route);
  // The top-level section the page is in; Home is in none.
  const section = chain[1];
  let body: ReactNode;
  if (!page || !meta) {
    body = <NotFound />;
  } else if (meta.layout === "bare") {
    body = (
      <main
        // A bare page lays out its own padding; the safe area adds to it.
        className="flex-1 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
        data-pagefind-body
        // The bare page's own h1 is a headline, not its name.
        data-pagefind-meta="title[data-title]"
        data-title={meta.title}
      >
        <page.default components={mdxComponents} />
      </main>
    );
  } else {
    const crumbs = chain.slice(1, -1);
    const sidebar = section !== undefined && section.children.length > 0;
    body = (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        {sidebar && <Sidebar section={section} />}
        <main
          className={cn(
            "min-w-0 flex-1 py-8 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] md:py-10 md:pr-[max(2.5rem,env(safe-area-inset-right))]",
            // Past md the sidebar, not the page, meets the left edge.
            sidebar
              ? "md:pl-10"
              : "md:pl-[max(2.5rem,env(safe-area-inset-left))]",
          )}
        >
          <article className="mx-auto max-w-3xl" data-pagefind-body>
            {crumbs.length > 0 && (
              <p
                className="mb-2 text-muted-foreground text-sm"
                data-pagefind-ignore
              >
                {crumbs.map((node, i) => (
                  <span key={node.route}>
                    {i > 0 && " / "}
                    {node.page ? (
                      <Link to={node.route} className="hover:text-foreground">
                        {node.title}
                      </Link>
                    ) : (
                      node.title
                    )}
                  </span>
                ))}
              </p>
            )}
            <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">
              {meta.title}
            </h1>
            {meta.description && (
              <p className="mt-3 max-w-prose text-lg text-muted-foreground">
                {meta.description}
              </p>
            )}
            <PageContents toc={page.toc} meta={meta} route={route} />
            <div className="mt-8">
              <page.default components={mdxComponents} />
            </div>
            <InTheDemos route={route} />
            {section && <PageFooter section={section} route={route} />}
          </article>
        </main>
        <Toc toc={page.toc} meta={meta} route={route} />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader section={section} />
      {body}
      {/* Here rather than beside App, so the server and the client render
          one tree and React's ids line up on hydration. */}
      <ClientOnly>
        <Toaster />
      </ClientOnly>
    </div>
  );
}
