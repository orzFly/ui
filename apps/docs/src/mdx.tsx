import installs from "virtual:orz-install";
import packages from "virtual:orz-packages";
import themeTable from "virtual:orz-themes";
import { buttonVariants } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import { ArrowUpRightIcon } from "lucide-react";
import {
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { BelowFloor } from "./below-floor.tsx";
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
      <Tag
        id={id}
        className={cn(
          "group scroll-mt-[calc(5rem+env(safe-area-inset-top))]",
          className,
        )}
      >
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
  return <CodeFrame lang={lang} contents={text} />;
}

function CodeFrame(props: { lang: string; contents: string }) {
  return (
    <div className="my-5 overflow-hidden rounded-lg border text-sm">
      <Code {...props} />
    </div>
  );
}

function InlineCode(props: ComponentProps<"code">) {
  return (
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.875em]"
      {...props}
    />
  );
}

function Table(props: ComponentProps<"table">) {
  return (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  );
}

function Th(props: ComponentProps<"th">) {
  return (
    <th
      className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
      {...props}
    />
  );
}

function Td(props: ComponentProps<"td">) {
  return <td className="border-b px-3 py-2 align-top" {...props} />;
}

function installOf(pkg: string) {
  const install = installs.find(({ name }) => name === pkg);
  if (!install) throw new Error(`${pkg}: not a published package`);
  return install;
}

/** A package's install lines, as its README has them. */
function Install({ pkg }: { pkg: string }) {
  return <CodeFrame lang="bash" contents={installOf(pkg).block} />;
}

/** Every package but `except`, each with its install line and the optional ones. */
function PackageInstalls({ except }: { except: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Package</Th>
          <Th>Install</Th>
        </tr>
      </thead>
      <tbody>
        {installs
          .filter(({ name }) => name !== except)
          .map((install) => (
            <tr key={install.name}>
              <Td>
                <InlineCode>{install.name}</InlineCode>
              </Td>
              <Td>
                <InlineCode>{install.command}</InlineCode>
                {install.optional.map((group) => (
                  <p key={group.command} className="mt-1.5">
                    For{" "}
                    {group.for.map((entry, index) => (
                      <span key={entry}>
                        {index > 0 && ", "}
                        <InlineCode>{entry}</InlineCode>
                      </span>
                    ))}
                    : <InlineCode>{group.command}</InlineCode>
                  </p>
                ))}
              </Td>
            </tr>
          ))}
      </tbody>
    </Table>
  );
}

/** Every package with its package.json description. */
function Packages() {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Package</Th>
          <Th>What it is</Th>
        </tr>
      </thead>
      <tbody>
        {packages.map(({ name, description }) => (
          <tr key={name}>
            <Td>
              <InlineCode>{name}</InlineCode>
            </Td>
            <Td>{description}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** `@orz/themes`' built-in themes, each side's own name and its variants, as its README has them. */
function BuiltinThemes() {
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Theme</Th>
            <Th>Import</Th>
            <Th>Light</Th>
            <Th>Dark</Th>
          </tr>
        </thead>
        <tbody>
          {themeTable.rows.map(({ label, id, name, light, dark }) => (
            <tr key={id}>
              <Td>{label}</Td>
              <Td>
                <InlineCode>{name}</InlineCode>
                {name !== id && (
                  <>
                    {" "}
                    (<InlineCode>{id}</InlineCode>)
                  </>
                )}
              </Td>
              <Td>{light}</Td>
              <Td>{dark}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {themeTable.amoledEverywhere && (
        <p className="my-4 leading-7">
          Every dark palette also has an AMOLED variant, which makes the
          background true black.
        </p>
      )}
    </>
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
  code: InlineCode,
  pre: Pre,
  table: Table,
  th: Th,
  td: Td,
  Do,
  DoDont,
  Dont,
  Doors,
  Example,
  BelowFloor,
  BuiltinThemes,
  Install,
  LinkButton,
  PackageInstalls,
  Packages,
  StorybookLink,
};
