import installs from "virtual:orz-install";
import packages from "virtual:orz-packages";
import themeTable from "virtual:orz-themes";
import { Button, buttonVariants } from "@orz/ui/components/button";
import { InlineCode } from "@orz/ui/components/inline-code";
import { Separator } from "@orz/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import { TextLink } from "@orz/ui/components/text-link";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import { CopyIcon } from "lucide-react";
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
import { BASE, Link } from "./router.tsx";
import { storybookHref } from "./routes.ts";

function Anchor({ href = "", children, ...props }: ComponentProps<"a">) {
  // A site path is written from the root, as the spec's URLs are; the base
  // goes on here, so no page writes /ui/.
  if (href.startsWith("/")) {
    const [path = "", hash] = href.split("#");
    return (
      <TextLink asChild>
        <Link {...props} to={path} hash={hash ? `#${hash}` : ""}>
          {children}
        </Link>
      </TextLink>
    );
  }
  return (
    <TextLink {...props} href={href}>
      {children}
    </TextLink>
  );
}

function heading(Tag: "h2" | "h3", className: string, ruled = false) {
  return function Heading({ id, children }: ComponentProps<"h2">) {
    const title = (
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
            className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 touch:hidden outline-none focus-visible:focus-ring"
          >
            #
          </a>
        )}
      </Tag>
    );
    if (!ruled) return title;
    return (
      <>
        {title}
        <Separator className="mb-4" />
      </>
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
    <div className="my-5 overflow-hidden rounded-lg border text-prose-sm">
      <Code {...props} />
    </div>
  );
}

function ProseTable(props: ComponentProps<"table">) {
  return (
    <div className="my-5">
      <Table purpose="prose" {...props} />
    </div>
  );
}

export function installOf(pkg: string) {
  const install = installs.find(({ name }) => name === pkg);
  if (!install) throw new Error(`${pkg}: not a published package`);
  return install;
}

/** A package's install lines, as its README has them. */
function Install({ pkg }: { pkg: string }) {
  return <CodeFrame lang="bash" contents={installOf(pkg).block} />;
}

/** An install line in running text, with a button that copies it. */
export function Command({ command }: { command: string }) {
  return (
    // A line too long for its box scrolls sideways, and the button stays in view beside it.
    <span className="inline-flex max-w-full items-center gap-0.5">
      <span className="min-w-0 overflow-x-auto whitespace-nowrap">
        <InlineCode>{command}</InlineCode>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Copy ${command}`}
        title="Copy"
        className="text-muted-foreground touch:hit-area"
        onClick={() => void copyToClipboard(command, "Install line copied")}
      >
        <CopyIcon />
      </Button>
    </span>
  );
}

/** Every package but `except`, each with its install line and the optional ones. */
function PackageInstalls({ except }: { except: string }) {
  return (
    <ProseTable>
      <TableHeader>
        <TableRow>
          <TableHead>Package</TableHead>
          <TableHead>Install</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {installs
          .filter(({ name }) => name !== except)
          .map((install) => (
            <TableRow key={install.name}>
              <TableCell>
                <InlineCode>{install.name}</InlineCode>
              </TableCell>
              <TableCell>
                <Command command={install.command} />
                {install.optional.map((group) => (
                  <p key={group.command} className="mt-1.5">
                    For{" "}
                    {group.for.map((entry, index) => (
                      <span key={entry}>
                        {index > 0 && ", "}
                        <InlineCode>{entry}</InlineCode>
                      </span>
                    ))}
                    : <Command command={group.command} />
                  </p>
                ))}
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </ProseTable>
  );
}

/** Every package with its package.json description. */
function Packages() {
  return (
    <ProseTable>
      <TableHeader>
        <TableRow>
          <TableHead>Package</TableHead>
          <TableHead>What it is</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {packages.map(({ name, description }) => (
          <TableRow key={name}>
            <TableCell>
              <InlineCode>{name}</InlineCode>
            </TableCell>
            <TableCell>{description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ProseTable>
  );
}

/** `@orz/themes`' built-in themes, each side's own name and its variants, as its README has them. */
function BuiltinThemes() {
  return (
    <>
      <ProseTable>
        <TableHeader>
          <TableRow>
            <TableHead>Theme</TableHead>
            <TableHead>Import</TableHead>
            <TableHead>Style</TableHead>
            <TableHead>Light</TableHead>
            <TableHead>Dark</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {themeTable.rows.map(({ label, id, name, styles, light, dark }) => (
            <TableRow key={id}>
              <TableCell>{label}</TableCell>
              <TableCell>
                <InlineCode>{name}</InlineCode>
                {name !== id && (
                  <>
                    {" "}
                    (<InlineCode>{id}</InlineCode>)
                  </>
                )}
              </TableCell>
              <TableCell>{styles.join(", ")}</TableCell>
              <TableCell>{light}</TableCell>
              <TableCell>{dark}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ProseTable>
      {themeTable.amoledEverywhere && (
        <p className="my-4 leading-prose">
          Every dark palette also has an AMOLED variant, which makes the
          background true black.
        </p>
      )}
    </>
  );
}

/** A link styled as a button, for a page's calls to action. */
export function LinkButton({
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

/** Storybook's root, or one page of it by title, for a link in prose. */
function StorybookLink({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return <TextLink href={storybookHref(BASE, title)}>{children}</TextLink>;
}

export const mdxComponents = {
  a: Anchor,
  h2: heading(
    "h2",
    "mt-12 pb-2 font-semibold text-heading-2 tracking-tight first:mt-0",
    true,
  ),
  h3: heading("h3", "mt-8 mb-3 font-semibold text-heading-3 tracking-tight"),
  p: (props: ComponentProps<"p">) => (
    <p className="my-4 max-w-prose leading-prose" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul
      className="my-4 ml-6 max-w-prose list-disc space-y-1.5 leading-prose"
      {...props}
    />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol
      className="my-4 ml-6 max-w-prose list-decimal space-y-1.5 leading-prose"
      {...props}
    />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="my-5 max-w-prose border-l-2 pl-4 text-muted-foreground"
      {...props}
    />
  ),
  hr: () => <hr className="my-10" />,
  code: InlineCode,
  pre: Pre,
  table: ProseTable,
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
  Do,
  DoDont,
  Dont,
  Example,
  BelowFloor,
  BuiltinThemes,
  Install,
  LinkButton,
  PackageInstalls,
  Packages,
  StorybookLink,
};
