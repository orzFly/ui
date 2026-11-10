import { Pane } from "@orz/ui/components/pane";
import { Toaster } from "@orz/ui/components/sonner";
import { TextLink } from "@orz/ui/components/text-link";
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
    <ReadingPage>
      <article>
        <h1 className="font-semibold text-heading-1 tracking-tight md:text-heading-1-wide">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          Nothing lives at this address.{" "}
          <TextLink asChild>
            <Link to="/">Go to the home page</Link>
          </TextLink>
          .
        </p>
      </article>
    </ReadingPage>
  );
}

/**
 * A page that is read rather than used: its text centred in the window, its
 * contents right against the text. The first column keeps the sidebar's room
 * on a page without one, so the text starts at one place on every page, and a
 * sidebar pushes it aside only once the window is too narrow to centre it.
 */
function ReadingPage({
  sidebar,
  toc,
  children,
}: {
  sidebar?: ReactNode;
  toc?: ReactNode;
  /** The article, which takes the text column. */
  children: ReactNode;
}) {
  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(15rem,1fr)_2.5rem_minmax(0,48rem)_2.5rem_minmax(max(0px,env(safe-area-inset-right)_-_2.5rem),1fr)] xl:grid-cols-[minmax(15rem,1fr)_2.5rem_minmax(0,48rem)_2.5rem_minmax(14rem,1fr)]">
      {sidebar && (
        <div className="col-start-1 row-start-1 hidden md:block">{sidebar}</div>
      )}
      {/* From the sidebar to the contents, the gaps either side of the text
          its own; below xl, on to the window's edge. */}
      <Pane
        purpose="document"
        asChild
        className={cn(
          "col-span-full row-start-1 md:grid md:grid-cols-subgrid xl:col-end-5",
          sidebar && "md:ml-60",
        )}
      >
        <main>
          <div className="col-span-full py-8 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] md:grid md:grid-cols-subgrid md:px-0 md:py-10 *:col-start-3">
            {children}
          </div>
        </main>
      </Pane>
      {toc && (
        <div className="col-start-5 row-start-1 hidden md:block">{toc}</div>
      )}
    </div>
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
    body = (
      <ReadingPage
        sidebar={
          section !== undefined &&
          section.children.length > 0 && <Sidebar section={section} />
        }
        toc={<Toc toc={page.toc} meta={meta} route={route} />}
      >
        <article data-pagefind-body>
          {crumbs.length > 0 && (
            <p
              className="mb-2 text-muted-foreground text-prose-sm"
              data-pagefind-ignore
            >
              {crumbs.map((node, i) => (
                <span key={node.route}>
                  {i > 0 && " / "}
                  {node.page ? (
                    <Link
                      to={node.route}
                      className="hover:text-foreground outline-none focus-visible:focus-ring"
                    >
                      {node.title}
                    </Link>
                  ) : (
                    node.title
                  )}
                </span>
              ))}
            </p>
          )}
          <h1 className="font-semibold text-heading-1 tracking-tight md:text-heading-1-wide">
            {meta.title}
          </h1>
          {meta.description && (
            <p className="mt-3 max-w-prose text-prose-lg text-muted-foreground">
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
      </ReadingPage>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col text-prose">
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
