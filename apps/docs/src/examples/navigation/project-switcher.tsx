import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { Pane } from "@orz/ui/components/pane";
import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import { isPlainClick } from "@orz/ui/lib/link";
import { ChevronsUpDownIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";

const PROJECTS = [
  { id: "website-relaunch", label: "Website relaunch" },
  { id: "mobile-app", label: "Mobile app" },
  { id: "billing", label: "Billing" },
  { id: "design-system", label: "Design system" },
  { id: "data-platform", label: "Data platform" },
  { id: "help-centre", label: "Help centre" },
  { id: "onboarding", label: "Onboarding" },
  { id: "security-review", label: "Security review" },
] as const;

type Project = (typeof PROJECTS)[number];

const SECTIONS = ["List", "Board", "Insights"];

// Each project row links to the same section of that project. A plain click
// goes in place, as an app's router would; any other click is the browser's,
// and opens the project in a new tab.
export function ProjectSwitcher() {
  const [project, setProject] = useState<Project>(PROJECTS[0]);
  const [section, setSection] = useState("Board");
  const [query, setQuery] = useState("");
  const href = (id: string, name: string) => `#${id}/${name.toLowerCase()}`;
  const inPlace = (go: () => void) => (event: MouseEvent) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    go();
  };
  return (
    <Pane purpose="panel" frame="inset">
      <Pane
        purpose="banner"
        edge="bottom"
        asChild
        className="flex items-center gap-3 px-3"
      >
        <header>
          <FilterMenu
            query={query}
            onQueryChange={setQuery}
            sections={[
              {
                id: "projects",
                rows: PROJECTS.filter((row) => matchText(row.label, query)),
              },
            ]}
            selectedId={project.id}
            rowLink={(row) => (
              // biome-ignore lint/a11y/useAnchorContent: the row's content goes inside
              <a
                href={href(row.id, section)}
                onClick={inPlace(() => setProject(row))}
              />
            )}
            renderRow={(row, state) => (
              <MatchedText text={row.label} query={state.query} />
            )}
            placeholder="Filter projects…"
            inputLabel="Filter projects"
            listLabel="Projects"
            className="w-64"
          >
            <Button variant="ghost" size="sm" className="min-w-0">
              <span className="truncate">{project.label}</span>
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </Button>
          </FilterMenu>
          <TabNav aria-label="Project">
            {SECTIONS.map((name) => (
              <TabNavLink
                key={name}
                href={href(project.id, name)}
                current={name === section}
                onClick={inPlace(() => setSection(name))}
              >
                {name}
              </TabNavLink>
            ))}
          </TabNav>
        </header>
      </Pane>
    </Pane>
  );
}
