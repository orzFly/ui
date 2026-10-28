import demoApis from "virtual:orz-demo-api";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { cn } from "@orz/ui/lib/utils";
import {
  ArrowUpRightIcon,
  InfoIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type Pointer, PointerToggle, useOverlaysFollow } from "../example.tsx";
import type { PageMeta } from "../page.ts";
import { loadedPage, pages } from "../pages.ts";
import { BASE, Link, useRouter } from "../router.tsx";
import { storybookHref } from "../routes.ts";
import { DemoCode } from "./demo-code.tsx";
import { demoFileNames } from "./demo-source.ts";
import {
  setAboutOpen,
  setSourceParam,
  useAboutOpen,
  useSourceParam,
} from "./demo-state.ts";

/** The Storybook pages a demo's files use, worked out from their imports. */
const apiOf = (route: string) => demoApis[demoDir(route)] ?? [];

/** The packages a demo is built from, read off the Storybook titles of what it uses. */
const packagesOf = (api: readonly string[]) => [
  ...new Set(api.map((title) => title.split("/")[0] ?? "")),
];

/** `/demos/inbox/` is the demo in `src/demos/inbox/`. */
export const demoDir = (route: string) => route.split("/").at(-2) ?? "";

/**
 * A demo's page: a bar over the demo, which fills the rest of the window below the site header.
 * The demo's root takes `h-full` and lays itself out in that box; anything taller scrolls inside
 * it. The bar switches between the demo and its source (the files under `src/demos/<page>/` and
 * the fixtures they import), forces either pointer's sizes, opens the About panel with `meta`'s
 * description and `meta.guidelines`, and takes the frame full screen. A demo page is
 * `layout: "bare"`.
 */
export function DemoPage({ children }: { children: ReactNode }) {
  const { route } = useRouter();
  const meta = loadedPage(route)?.meta;
  const dir = demoDir(route);
  const source = useSourceParam();
  const aboutOpen = useAboutOpen();
  const [pointer, setPointer] = useState<Pointer>();
  const preview = useRef<HTMLDivElement>(null);
  useOverlaysFollow(preview, pointer);
  const fullScreen = useFullScreen();
  const about = <About meta={meta} api={apiOf(route)} />;
  return (
    <Tabs
      value={source === null ? "preview" : "code"}
      onValueChange={(value) =>
        setSourceParam(value === "code" ? (demoFileNames(dir)[0] ?? "") : null)
      }
      className={cn(
        "gap-0 bg-background",
        fullScreen.on
          ? "fixed inset-0 z-50"
          : "h-[calc(100dvh-3.5rem-env(safe-area-inset-top))]",
      )}
    >
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b bg-muted/40 px-2 py-1 md:gap-3 md:px-4">
        <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
          <Link
            to="/demos/"
            className="hidden text-muted-foreground hover:text-foreground sm:inline"
            data-pagefind-ignore
          >
            Demos
          </Link>
          <span aria-hidden className="hidden text-muted-foreground sm:inline">
            /
          </span>
          <h1 className="truncate font-semibold">{meta?.title}</h1>
        </div>
        <TabsList data-pagefind-ignore className="ml-auto sm:ml-0">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <div
          data-pagefind-ignore
          className="flex items-center gap-1 sm:ml-auto"
        >
          {source === null && (
            <PointerToggle
              pointer={pointer}
              onChange={setPointer}
              className="hidden md:flex"
            />
          )}
          <Button
            variant={aboutOpen ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={aboutOpen}
            className="hidden lg:inline-flex"
            onClick={() => setAboutOpen(!aboutOpen)}
          >
            <InfoIcon />
            About
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="About this demo"
                className="lg:hidden"
              >
                <InfoIcon />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] gap-0 overflow-y-auto"
            >
              <SheetTitle className="px-5 pt-5 text-base">
                {meta?.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                What the demo shows, and the guidelines it puts into practice
              </SheetDescription>
              {about}
            </SheetContent>
          </Sheet>
          {fullScreen.available && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
              onClick={fullScreen.toggle}
            >
              {fullScreen.on ? <MinimizeIcon /> : <MaximizeIcon />}
              {fullScreen.on ? "Exit full screen" : "Full screen"}
            </Button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Mounted while hidden, so the demo keeps its state across a look at the code. */}
        <TabsContent
          value="preview"
          forceMount
          className="min-w-0 flex-1 data-[state=inactive]:hidden"
        >
          <div
            ref={preview}
            data-pointer={pointer}
            className="h-full overflow-auto"
          >
            {children}
          </div>
        </TabsContent>
        <TabsContent
          value="code"
          data-pagefind-ignore
          className="min-w-0 flex-1"
        >
          <DemoCode dir={dir} source={source} onSource={setSourceParam} />
        </TabsContent>
        {/* Rendered while closed too, so search indexes the description it holds. */}
        <aside
          aria-label="About this demo"
          className={cn(
            "hidden w-80 shrink-0 overflow-y-auto border-l",
            aboutOpen && "lg:block",
          )}
        >
          {about}
        </aside>
      </div>
    </Tabs>
  );
}

function About({
  meta,
  api,
}: {
  meta: PageMeta | undefined;
  api: readonly string[];
}) {
  const id = useId();
  const guidelines = meta?.guidelines ?? [];
  return (
    <div className="p-5 text-sm">
      {meta?.description && (
        <p className="text-base text-muted-foreground">{meta.description}</p>
      )}
      {guidelines.length > 0 && (
        <section aria-labelledby={`${id}-guidelines`} className="mt-6">
          <h2 id={`${id}-guidelines`} className="mb-2 font-semibold">
            Guidelines shown here
          </h2>
          <ul className="grid gap-3">
            {guidelines.map(({ route, where }) => (
              <li key={route}>
                <Link
                  to={route}
                  className="inline-flex min-h-8 items-center font-medium underline underline-offset-4"
                >
                  {pageTitle(route)}
                </Link>
                <p className="text-muted-foreground">{where}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {api.length > 0 && (
        <section aria-labelledby={`${id}-components`} className="mt-6">
          <h2 id={`${id}-components`} className="mb-1 font-semibold">
            Components
          </h2>
          <ul data-pagefind-ignore>
            {api.map((title) => (
              <li key={title}>
                {/* Several packages export a `Content` page, so a demo names the package too. */}
                <a
                  href={storybookHref(BASE, title)}
                  className="inline-flex min-h-8 items-center text-muted-foreground hover:text-foreground"
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
  );
}

/**
 * The whole document goes full screen rather than the frame: a demo's menus and dialogs portal to
 * `<body>`, outside the frame, and would not show. The frame covers the site header meanwhile.
 * Unavailable where a page cannot go full screen (an iPhone).
 */
function useFullScreen() {
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setAvailable(document.fullscreenEnabled);
    const onChange = () => setOn(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // A page without the frame would be left full screen with nothing to leave it by.
      if (document.fullscreenElement !== null) void document.exitFullscreen();
    };
  }, []);
  const toggle = () => {
    if (document.fullscreenElement !== null) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };
  return { available, on, toggle };
}

const pageTitle = (route: string) =>
  pages.find((page) => page.route === route)?.meta.title ?? route;

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
            {packagesOf(apiOf(route)).map((name) => (
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
