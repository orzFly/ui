import site from "virtual:orz-site";
import { ListIcon } from "lucide-react";
import { Command } from "../mdx.tsx";
import { pages } from "../pages.ts";
import { BASE, Link } from "../router.tsx";
import { storybookHref } from "../routes.ts";
import { HomeModule } from "./module.tsx";

const SKILL = "skills/orz-ui/SKILL.md";

/** What an agent reads, in order: the files written for it, then the site's pages. */
type Step =
  | { kind: "page"; route: string }
  | {
      kind: "file";
      title: string;
      description: string;
      href: string;
      command?: string;
    };

const STEPS: Step[] = [
  {
    kind: "file",
    title: "llms.txt",
    description: "Every page as Markdown, indexed: read this before the HTML.",
    href: `${BASE}llms.txt`,
  },
  {
    kind: "file",
    title: "Skill",
    description: "Teaches an agent to build with @orz/ui. Install it:",
    href: `${BASE}${SKILL}`,
    command: `curl -fsSL --create-dirs -o .claude/${SKILL} ${site.url}${SKILL}`,
  },
  { kind: "page", route: "/start/" },
  { kind: "page", route: "/guidelines/principles/" },
  { kind: "page", route: "/guidelines/" },
  {
    kind: "file",
    title: "Storybook",
    description: "Every export, live, with its props: the Storybook reference.",
    href: storybookHref(BASE),
  },
  { kind: "page", route: "/demos/" },
];

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
        {STEPS.map((step, index) => {
          const { title, description } =
            step.kind === "page" ? pageAt(step.route) : step;
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
              {step.kind === "page" ? (
                <Link to={step.route} className={row}>
                  {body}
                </Link>
              ) : (
                <a href={step.href} className={row}>
                  {body}
                </a>
              )}
              {step.kind === "file" && step.command && (
                <div className="pr-2 pb-1.5 pl-9 font-mono">
                  <Command command={step.command} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </HomeModule>
  );
}
