import { buttonVariants } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import { ArrowUpRightIcon } from "lucide-react";
import {
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Code } from "./code.tsx";
import { Do, DoDont, Dont } from "./do-dont.tsx";
import { Example } from "./example.tsx";
import { nav } from "./pages.ts";
import { BASE, Link } from "./router.tsx";
import { pagesIn, storybookHref } from "./routes.ts";

function Anchor({ href = "", children, ...props }: ComponentProps<"a">) {
  const className = "font-medium underline underline-offset-4";
  // A site path is written from the root, as the spec's URLs are; the base
  // goes on here, so no page writes /ui/.
  if (href.startsWith("/")) {
    const [path = "", hash] = href.split("#");
    return (
      <Link
        {...props}
        to={path}
        hash={hash ? `#${hash}` : ""}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <a {...props} href={href} className={className}>
      {children}
    </a>
  );
}

function heading(Tag: "h2" | "h3", className: string) {
  return function Heading({ id, children }: ComponentProps<"h2">) {
    return (
      <Tag id={id} className={cn("group scroll-mt-20", className)}>
        {children}
        {id && (
          <a
            href={`#${id}`}
            aria-label="Link to this section"
            data-pagefind-ignore
            className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
          >
            #
          </a>
        )}
      </Tag>
    );
  };
}

/** A fenced block; MDX hands it over as `<pre><code className="language-…">`. */
function Pre({ children }: ComponentProps<"pre">) {
  const code = isValidElement(children)
    ? (children as ReactElement<{ className?: string; children?: ReactNode }>)
    : null;
  const lang = /language-(\S+)/.exec(code?.props.className ?? "")?.[1] ?? "";
  const text = String(code?.props.children ?? "").replace(/\n$/, "");
  return (
    <div className="my-5 overflow-hidden rounded-lg border text-sm">
      <Code lang={lang} contents={text} />
    </div>
  );
}

/** A link styled as a button, for a page's calls to action. */
function LinkButton({
  to,
  variant = "default",
  children,
}: {
  /** A path from the site root; `/storybook/` too. */
  to: string;
  variant?: "default" | "outline";
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonVariants({ variant, size: "lg" }))}>
      {children}
    </Link>
  );
}

/** One card per door into the site: its sections, from the nav, and Storybook. */
function Doors() {
  const card =
    "flex flex-col gap-1 rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:bg-accent";
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {nav.children.map((section) => (
        <Link
          key={section.route}
          to={(pagesIn(section)[0] ?? section).route}
          className={card}
        >
          <span className="font-semibold">{section.title}</span>
          {section.description && (
            <span className="text-muted-foreground text-sm">
              {section.description}
            </span>
          )}
        </Link>
      ))}
      <a href={storybookHref(BASE)} className={card}>
        <span className="inline-flex items-center font-semibold">
          Components <ArrowUpRightIcon className="ml-1 size-4" />
        </span>
        <span className="text-muted-foreground text-sm">
          Every export, live, with its props: the Storybook reference.
        </span>
      </a>
    </div>
  );
}

/** Storybook's root, or one page of it by title, for a link in prose. */
function StorybookLink({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={storybookHref(BASE, title)}
      className="font-medium underline underline-offset-4"
    >
      {children}
    </a>
  );
}

export const mdxComponents = {
  a: Anchor,
  h2: heading(
    "h2",
    "mt-12 mb-4 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0",
  ),
  h3: heading("h3", "mt-8 mb-3 font-semibold text-lg tracking-tight"),
  p: (props: ComponentProps<"p">) => (
    <p className="my-4 leading-7" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul className="my-4 ml-6 list-disc space-y-1.5 leading-7" {...props} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol className="my-4 ml-6 list-decimal space-y-1.5 leading-7" {...props} />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="my-5 border-l-2 pl-4 text-muted-foreground"
      {...props}
    />
  ),
  hr: () => <hr className="my-10" />,
  code: (props: ComponentProps<"code">) => (
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.875em]"
      {...props}
    />
  ),
  pre: Pre,
  table: (props: ComponentProps<"table">) => (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentProps<"th">) => (
    <th
      className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
      {...props}
    />
  ),
  td: (props: ComponentProps<"td">) => (
    <td className="border-b px-3 py-2 align-top" {...props} />
  ),
  Do,
  DoDont,
  Dont,
  Doors,
  Example,
  LinkButton,
  StorybookLink,
};
