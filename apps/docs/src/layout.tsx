import { Button } from "@orz/ui/components/button";
import {
  LinkCard,
  LinkCardLabel,
  LinkCardTitle,
} from "@orz/ui/components/link-card";
import {
  NavList,
  NavListFrame,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { Separator } from "@orz/ui/components/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import { useSlashShortcut } from "@orz/ui/hooks/use-slash-shortcut";
import { cn } from "@orz/ui/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ListIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ClientOnly } from "./hydrated.tsx";
import { inTheDemosToc } from "./in-the-demos.tsx";
import type { PageMeta, TocEntry } from "./page.ts";
import { nav } from "./pages.ts";
import { BASE, Link, useRouter } from "./router.tsx";
import { type NavNode, pagesIn, storybookHref } from "./routes.ts";
import { SearchBox, SheetSearch } from "./search-box.tsx";
import { useShortcutsEnabled } from "./shortcuts.ts";

/** The top bar's sections: content/'s top-level pages and directories, Home aside. */
const sections = nav.children;

function Logo() {
  return (
    <Link
      to="/"
      className="font-semibold tracking-tight outline-none focus-visible:focus-ring"
    >
      @orz<span className="font-medium text-muted-foreground">/ui</span>
    </Link>
  );
}

/** ThemeMenu's own trigger reads matchMedia while rendering, which the server cannot. */
function ThemeButton() {
  return (
    <ClientOnly
      fallback={
        <Button variant="ghost" size="icon" aria-label="Theme" disabled />
      }
    >
      <ThemeMenu />
    </ClientOnly>
  );
}

/** Whether the phone nav is open, and whether it opened to search. */
type NavOpen = boolean | "search";

export function SiteHeader({ section }: { section: NavNode | undefined }) {
  const box = useRef<HTMLInputElement>(null);
  const sheetBox = useRef<HTMLInputElement>(null);
  const [nav, setNav] = useState<NavOpen>(false);
  // The top bar's box is hidden on a phone; there the key opens the nav at its box.
  useSlashShortcut(
    () => {
      if (box.current?.checkVisibility()) box.current.focus();
      else setNav("search");
    },
    { enabled: useShortcutsEnabled() },
  );
  return (
    <Pane
      purpose="banner"
      edge="bottom"
      asChild
      className="sticky top-0 z-40 h-(--site-header) pt-[env(safe-area-inset-top)]"
    >
      <header>
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:gap-6 md:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.25rem,env(safe-area-inset-left))]">
          <MobileNav
            section={section}
            open={nav}
            onOpenChange={setNav}
            searchRef={sheetBox}
          />
          <Logo />
          <TabNav aria-label="Site" className="hidden md:flex">
            {sections.map((node) => (
              <TabNavLink key={node.route} current={node === section} asChild>
                <Link to={firstPage(node).route}>{node.title}</Link>
              </TabNavLink>
            ))}
            <TabNavLink href={storybookHref(BASE)}>
              Storybook
              <ArrowUpRightIcon />
            </TabNavLink>
          </TabNav>
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <SearchBox
              inputRef={box}
              className="hidden w-56 md:block lg:w-64"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Search"
              onClick={() => setNav("search")}
            >
              <SearchIcon className="size-5" />
            </Button>
            <ThemeButton />
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings/" aria-label="Settings">
                <SettingsIcon />
              </Link>
            </Button>
          </div>
        </div>
      </header>
    </Pane>
  );
}

/** A section's own page, or its first one when the directory has no index. */
function firstPage(node: NavNode): NavNode {
  return pagesIn(node)[0] ?? node;
}

function MobileNav({
  section,
  open,
  onOpenChange,
  searchRef,
}: {
  section: NavNode | undefined;
  open: NavOpen;
  onOpenChange: (open: NavOpen) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const { route } = useRouter();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation closes the sheet.
  useEffect(() => onOpenChange(false), [route]);
  return (
    <Sheet open={open !== false} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:hidden"
          aria-label="Menu"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="gap-0 pb-8"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // Focus on the box would raise a phone's keyboard over a nav the
          // reader opened to browse.
          if (open === "search") searchRef.current?.focus();
          else (event.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Site navigation
          </SheetDescription>
        </SheetHeader>
        <div className="px-2">
          <SheetSearch inputRef={searchRef} onPick={() => onOpenChange(false)}>
            <nav aria-label="Site" className="mt-2">
              <NavList>
                {sections.map((node) => (
                  <NavListItem key={node.route}>
                    <NavListLink
                      asChild
                      current={node === section && node.children.length === 0}
                    >
                      <Link to={firstPage(node).route}>{node.title}</Link>
                    </NavListLink>
                    {node === section && node.children.length > 0 && (
                      <NavTree node={node} depth={1} />
                    )}
                  </NavListItem>
                ))}
                <NavListItem>
                  <NavListLink href={storybookHref(BASE)}>
                    Storybook
                    <ArrowUpRightIcon />
                  </NavListLink>
                </NavListItem>
              </NavList>
            </nav>
          </SheetSearch>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A section's pages; a directory is a heading over its own. */
function NavTree({ node, depth = 0 }: { node: NavNode; depth?: number }) {
  const { route } = useRouter();
  return (
    <NavList>
      {node.children.map((child) => (
        <NavListItem key={child.route}>
          {child.children.length === 0 ? (
            <NavListLink asChild depth={depth} current={child.route === route}>
              <Link to={child.route}>{child.title}</Link>
            </NavListLink>
          ) : (
            <>
              <NavListHeading asChild depth={depth}>
                <h3>
                  {child.page ? (
                    <Link to={child.route}>{child.title}</Link>
                  ) : (
                    child.title
                  )}
                </h3>
              </NavListHeading>
              <NavTree node={child} depth={depth} />
            </>
          )}
        </NavListItem>
      ))}
    </NavList>
  );
}

export function Sidebar({ section }: { section: NavNode }) {
  return (
    <Pane
      purpose="sidebar"
      edge="end"
      asChild
      className="sticky top-(--site-header) hidden h-[calc(100dvh-var(--site-header))] w-60 shrink-0 flex-col pr-2 pl-[max(0.5rem,env(safe-area-inset-left))] md:flex"
    >
      <aside>
        <NavListFrame className="flex min-h-0 flex-1 flex-col">
          <nav
            aria-label={section.title}
            className="min-h-0 flex-1 overflow-y-auto py-4"
          >
            <NavTree node={section} />
          </nav>
        </NavListFrame>
      </aside>
    </Pane>
  );
}

/** The heading the reader is in: the last one scrolled past the header. */
function useActiveHeading(toc: TocEntry[]): string | undefined {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    const onScroll = () => {
      let current: string | undefined;
      for (const { id } of toc) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top < 96) current = id;
      }
      setActive(current ?? toc[0]?.id);
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [toc]);
  return active;
}

/** The page's headings, then the demos that show it. */
function usePageToc(headings: TocEntry[], route: string) {
  return useMemo(
    () => [...headings, ...inTheDemosToc(route)],
    [headings, route],
  );
}

function TocList({
  toc,
  active,
  onPick,
}: {
  toc: TocEntry[];
  active: string | undefined;
  onPick?: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <NavList variant="rail">
      {toc.map((entry) => (
        <NavListItem key={entry.id}>
          <NavListLink
            href={`#${entry.id}`}
            current={entry.id === active ? "location" : undefined}
            depth={entry.depth === 3 ? 1 : 0}
            onClick={onPick && ((event) => onPick(event, entry.id))}
          >
            {entry.text}
          </NavListLink>
        </NavListItem>
      ))}
    </NavList>
  );
}

export function Toc({
  toc: headings,
  meta,
  route,
}: {
  toc: TocEntry[];
  meta: PageMeta;
  route: string;
}) {
  const toc = usePageToc(headings, route);
  const active = useActiveHeading(toc);
  const api = meta.api ?? [];
  if (toc.length === 0 && api.length === 0) return null;
  return (
    <aside className="sticky top-(--site-header) hidden max-h-[calc(100dvh-var(--site-header))] w-56 shrink-0 overflow-y-auto px-4 py-8 text-prose-sm xl:block">
      {toc.length > 0 && (
        <nav aria-label="On this page">
          <p className="mb-2 font-medium">On this page</p>
          <NavListFrame>
            <TocList toc={toc} active={active} />
          </NavListFrame>
        </nav>
      )}
      {api.length > 0 && <ApiLinks titles={api} className="mt-6" />}
    </aside>
  );
}

/**
 * Below xl, where the side column is gone: the page's contents in a sheet
 * opened from the page header, and its Storybook pages on one line beside it.
 */
export function PageContents({
  toc: headings,
  meta,
  route,
}: {
  toc: TocEntry[];
  meta: PageMeta;
  route: string;
}) {
  const toc = usePageToc(headings, route);
  const active = useActiveHeading(toc);
  const [open, setOpen] = useState(false);
  // The sheet locks the page's scroll until it has closed, so the jump waits for that.
  const target = useRef<string | null>(null);
  const api = meta.api ?? [];
  if (toc.length === 0 && api.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-prose-sm xl:hidden">
      {toc.length > 0 && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" data-pagefind-ignore>
              <ListIcon />
              On this page
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="gap-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onCloseAutoFocus={(event) => {
              const id = target.current;
              target.current = null;
              if (id === null) return;
              event.preventDefault();
              location.hash = id;
            }}
          >
            <SheetHeader className="pb-0">
              <SheetTitle icon={<ListIcon />}>On this page</SheetTitle>
              <SheetDescription className="sr-only">
                The sections of {meta.title}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="px-5 pt-3 text-prose">
              <nav aria-label="On this page">
                <TocList
                  toc={toc}
                  active={active}
                  onPick={(event, id) => {
                    event.preventDefault();
                    target.current = id;
                    setOpen(false);
                  }}
                />
              </nav>
            </SheetBody>
          </SheetContent>
        </Sheet>
      )}
      {api.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3" data-pagefind-ignore>
          <span className="font-medium">API</span>
          {api.map((title) => (
            <a
              key={title}
              href={storybookHref(BASE, title)}
              className="inline-flex min-h-7 items-center text-muted-foreground hover:text-foreground touch:min-h-11 outline-none focus-visible:focus-ring"
            >
              {title.split("/").at(-1)}
              <ArrowUpRightIcon className="ml-0.5 size-3.5" />
            </a>
          ))}
        </p>
      )}
    </div>
  );
}

/** The Storybook pages for the components a page is about. */
export function ApiLinks({
  titles,
  className,
}: {
  titles: string[];
  className?: string;
}) {
  return (
    <Pane
      purpose="panel"
      frame="card"
      className={cn("p-3", className)}
      data-pagefind-ignore
    >
      <p className="mb-1 font-medium">API</p>
      <ul>
        {titles.map((title) => (
          <li key={title}>
            <a
              href={storybookHref(BASE, title)}
              className="inline-flex items-center py-0.5 text-muted-foreground hover:text-foreground outline-none focus-visible:focus-ring"
            >
              {title.split("/").at(-1)}
              <ArrowUpRightIcon className="ml-0.5 size-3.5" />
            </a>
          </li>
        ))}
      </ul>
    </Pane>
  );
}

/** Previous and next within the section, in nav order. */
export function PageFooter({
  section,
  route,
}: {
  section: NavNode;
  route: string;
}) {
  const order = pagesIn(section);
  const index = order.findIndex((node) => node.route === route);
  if (index < 0 || order.length < 2) return null;
  const previous = order[index - 1];
  const next = order[index + 1];
  return (
    <>
      <Separator className="mt-16 mb-6" />
      <nav
        aria-label="Previous and next"
        data-pagefind-ignore
        className="grid gap-3 sm:grid-cols-2"
      >
        {previous ? (
          <LinkCard asChild>
            <Link to={previous.route}>
              <LinkCardLabel>
                <ArrowLeftIcon /> Previous
              </LinkCardLabel>
              <LinkCardTitle>{previous.title}</LinkCardTitle>
            </Link>
          </LinkCard>
        ) : (
          <span />
        )}
        {next && (
          <LinkCard asChild className="items-end text-right">
            <Link to={next.route}>
              <LinkCardLabel>
                Next <ArrowRightIcon />
              </LinkCardLabel>
              <LinkCardTitle>{next.title}</LinkCardTitle>
            </Link>
          </LinkCard>
        )}
      </nav>
    </>
  );
}
