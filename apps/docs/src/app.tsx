import { Toaster } from "@orz/ui/components/sonner";
import { type ReactNode, useEffect } from "react";
import { documentTitle } from "./head.ts";
import { ClientOnly } from "./hydrated.tsx";
import { ApiLinks, PageFooter, Sidebar, SiteHeader, Toc } from "./layout.tsx";
import { mdxComponents } from "./mdx.tsx";
import { loadedPage, nav } from "./pages.ts";
import { Link, useRouter } from "./router.tsx";
import { trail } from "./routes.ts";

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
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
        className="flex-1"
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
    body = (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        {section && section.children.length > 0 && (
          <Sidebar section={section} />
        )}
        <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
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
              <p className="mt-3 text-lg text-muted-foreground">
                {meta.description}
              </p>
            )}
            <div className="mt-8">
              <page.default components={mdxComponents} />
            </div>
            {meta.api && meta.api.length > 0 && (
              <ApiLinks titles={meta.api} className="mt-10 xl:hidden" />
            )}
            {section && <PageFooter section={section} route={route} />}
          </article>
        </main>
        <Toc toc={page.toc} meta={meta} />
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
