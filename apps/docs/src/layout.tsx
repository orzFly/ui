import { Button } from "@orz/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
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
    <Link to="/" className="font-semibold tracking-tight">
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

// The current section is the mosaic's current tab: a box in the page's colour
// that covers the header's bottom rule, so it joins the page below, with a
// primary edge across its top.
const topLink =
  "-mb-px flex items-center self-stretch px-3 text-muted-foreground transition-colors hover:text-foreground";

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
    <header className="sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:gap-6 md:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.25rem,env(safe-area-inset-left))]">
        <MobileNav
          section={section}
          open={nav}
          onOpenChange={setNav}
          searchRef={sheetBox}
        />
        <Logo />
        <nav aria-label="Site" className="hidden self-stretch md:flex">
          {sections.map((node) => (
            <Link
              key={node.route}
              to={firstPage(node).route}
              className={cn(
                topLink,
                node === section &&
                  "border-x bg-background font-medium text-foreground tab-cue",
              )}
            >
              {node.title}
            </Link>
          ))}
          <a href={storybookHref(BASE)} className={topLink}>
            Storybook
            <ArrowUpRightIcon className="ml-0.5 inline size-3.5 align-[-2px]" />
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <SearchBox inputRef={box} className="hidden w-56 md:block lg:w-64" />
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
          <Button
            variant="ghost"
            size="icon"
            className="aria-[current=page]:bg-muted"
            asChild
          >
            <Link to="/settings/" aria-label="Settings">
              <SettingsIcon />
            </Link>
          </Button>
        </div>
      </div>
    </header>
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
        className="gap-0 overflow-y-auto p-2 pb-8"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // Focus on the box would raise a phone's keyboard over a nav the
          // reader opened to browse.
          if (open === "search") searchRef.current?.focus();
          else (event.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetTitle className="flex h-11 items-center px-3">
          <Logo />
        </SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>
        <SheetSearch inputRef={searchRef} onPick={() => onOpenChange(false)}>
          <nav aria-label="Site" className="mt-2 text-base">
            {sections.map((node) => (
              <div key={node.route}>
                <Link
                  to={firstPage(node).route}
                  className={cn(
                    rowClass("touch"),
                    "font-medium text-foreground",
                  )}
                >
                  {node.title}
                </Link>
                {node === section && node.children.length > 0 && (
                  <div className="mb-2 ml-3 border-l pl-1">
                    <NavTree node={node} size="touch" />
                  </div>
                )}
              </div>
            ))}
            <a
              href={storybookHref(BASE)}
              className={cn(rowClass("touch"), "font-medium text-foreground")}
            >
              Storybook
              <ArrowUpRightIcon className="ml-1 size-4" />
            </a>
          </nav>
        </SheetSearch>
      </SheetContent>
    </Sheet>
  );
}

function rowClass(size: "pointer" | "touch") {
  return cn(
    "flex items-center px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:state-cue",
    size === "touch" ? "min-h-11" : "min-h-8 touch:min-h-11",
  );
}

/** A section's pages; a directory is a heading over its own. */
export function NavTree({
  node,
  size = "pointer",
}: {
  node: NavNode;
  size?: "pointer" | "touch";
}) {
  return (
    <ul>
      {node.children.map((child) => (
        <li key={child.route}>
          {child.children.length === 0 ? (
            <Link to={child.route} className={rowClass(size)}>
              {child.title}
            </Link>
          ) : (
            <>
              <h3 className="mt-4 mb-1 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {child.page ? (
                  <Link to={child.route} className="hover:text-foreground">
                    {child.title}
                  </Link>
                ) : (
                  child.title
                )}
              </h3>
              <NavTree node={child} size={size} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar({ section }: { section: NavNode }) {
  return (
    <aside className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-60 shrink-0 overflow-y-auto border-r py-4 pr-2 pl-[max(0.5rem,env(safe-area-inset-left))] text-sm md:block">
      <nav aria-label={section.title}>
        <NavTree node={section} />
      </nav>
    </aside>
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
    <ul className="border-l">
      {toc.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            onClick={onPick && ((event) => onPick(event, entry.id))}
            className={cn(
              "-ml-px flex min-h-7 items-center border-l border-transparent py-1 text-muted-foreground transition-colors hover:text-foreground touch:min-h-11",
              entry.depth === 3 ? "pl-6" : "pl-3",
              entry.id === active && "border-foreground text-foreground",
            )}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ul>
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
    <aside className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] hidden max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-56 shrink-0 overflow-y-auto px-4 py-8 text-sm xl:block">
      {toc.length > 0 && (
        <nav aria-label="On this page">
          <p className="mb-2 font-medium">On this page</p>
          <TocList toc={toc} active={active} />
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
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm xl:hidden">
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
            className="max-h-[85dvh] gap-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
            onCloseAutoFocus={(event) => {
              const id = target.current;
              target.current = null;
              if (id === null) return;
              event.preventDefault();
              location.hash = id;
            }}
          >
            <SheetTitle icon={<ListIcon />} className="px-5 pt-5">
              On this page
            </SheetTitle>
            <SheetDescription className="sr-only">
              The sections of {meta.title}
            </SheetDescription>
            <nav aria-label="On this page" className="px-5 pt-3 text-base">
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
              className="inline-flex min-h-7 items-center text-muted-foreground hover:text-foreground touch:min-h-11"
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
    <div
      className={cn("rounded-lg border p-3", className)}
      data-pagefind-ignore
    >
      <p className="mb-1 font-medium">API</p>
      <ul>
        {titles.map((title) => (
          <li key={title}>
            <a
              href={storybookHref(BASE, title)}
              className="inline-flex items-center py-0.5 text-muted-foreground hover:text-foreground"
            >
              {title.split("/").at(-1)}
              <ArrowUpRightIcon className="ml-0.5 size-3.5" />
            </a>
          </li>
        ))}
      </ul>
    </div>
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
  const card =
    "flex min-h-11 flex-col gap-0.5 rounded-lg border px-4 py-3 transition-colors hover:bg-accent";
  return (
    <nav
      aria-label="Previous and next"
      data-pagefind-ignore
      className="mt-16 grid gap-3 border-t pt-6 sm:grid-cols-2"
    >
      {previous ? (
        <Link to={previous.route} className={card}>
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <ArrowLeftIcon className="size-3.5" /> Previous
          </span>
          <span className="font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.route} className={cn(card, "items-end text-right")}>
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            Next <ArrowRightIcon className="size-3.5" />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
