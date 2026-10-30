import { ListIcon } from "lucide-react";
import { pages } from "../pages.ts";
import { BASE, Link } from "../router.tsx";
import { storybookHref } from "../routes.ts";
import { HomeModule } from "./module.tsx";

/** The routes an agent reads, in order; `null` is Storybook, which has no page here. */
const ROUTES = [
  "/start/",
  "/guidelines/principles/",
  "/guidelines/",
  null,
  "/demos/",
] as const;

const STORYBOOK = {
  title: "Storybook",
  description: "Every export, live, with its props: the Storybook reference.",
};

function pageAt(route: string) {
  const page = pages.find((entry) => entry.route === route);
  if (!page) throw new Error(`For agents: no page at ${route}`);
  return page.meta;
}

const row =
  "grid min-h-row grid-cols-[1.25rem_minmax(0,auto)_minmax(0,1fr)] items-start gap-x-2 px-2 py-1 transition-colors hover:bg-accent touch:min-h-11";

export function ForAgents({ className }: { className?: string }) {
  return (
    <HomeModule
      icon={<ListIcon />}
      title="For agents"
      meta="read in this order"
      className={className}
    >
      <ol className="text-ui" data-pagefind-ignore>
        {ROUTES.map((route, index) => {
          const { title, description } =
            route === null ? STORYBOOK : pageAt(route);
          const body = (
            <>
              <span aria-hidden className="text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="font-medium text-primary">{title}</span>
              <span className="line-clamp-2 text-muted-foreground">
                {description}
              </span>
            </>
          );
          return (
            <li key={title} className="border-b last:border-b-0">
              {route === null ? (
                <a href={storybookHref(BASE)} className={row}>
                  {body}
                </a>
              ) : (
                <Link to={route} className={row}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </HomeModule>
  );
}
