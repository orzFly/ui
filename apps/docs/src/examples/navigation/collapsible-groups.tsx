import {
  NavList,
  NavListFrame,
  NavListGroup,
  NavListGroupContent,
  NavListGroupRow,
  NavListGroupToggle,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { isPlainClick } from "@orz/ui/lib/link";
import { FolderArchiveIcon, FolderIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";

const PROJECTS = [
  { id: "website", name: "Website", pages: ["Issues", "Board", "Releases"] },
  { id: "mobile-app", name: "Mobile app", pages: ["Issues", "Board"] },
];

const ARCHIVED = [
  { id: "old-site", name: "Old site" },
  { id: "pilot", name: "Pilot" },
];

export function CollapsibleGroups() {
  const [current, setCurrent] = useState("website/board");
  const go = (place: string) => (event: MouseEvent) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    setCurrent(place);
  };
  return (
    <NavListFrame className="max-w-64">
      <nav aria-label="Projects" className="py-2">
        <NavList>
          {PROJECTS.map((project) => (
            <NavListItem key={project.id}>
              <NavListGroup>
                <NavListGroupRow>
                  <NavListLink
                    href={`#${project.id}`}
                    current={current === project.id}
                    onClick={go(project.id)}
                  >
                    <FolderIcon />
                    {project.name}
                  </NavListLink>
                  <NavListGroupToggle />
                </NavListGroupRow>
                <NavListGroupContent>
                  <NavList>
                    {project.pages.map((page) => {
                      const place = `${project.id}/${page.toLowerCase()}`;
                      return (
                        <NavListItem key={page}>
                          <NavListLink
                            href={`#${place}`}
                            depth={1}
                            current={current === place}
                            onClick={go(place)}
                          >
                            {page}
                          </NavListLink>
                        </NavListItem>
                      );
                    })}
                  </NavList>
                </NavListGroupContent>
              </NavListGroup>
            </NavListItem>
          ))}
          <NavListItem>
            <NavListGroup defaultOpen={false}>
              <NavListHeading asChild>
                <h3>
                  <NavListGroupToggle>Archived</NavListGroupToggle>
                </h3>
              </NavListHeading>
              <NavListGroupContent>
                <NavList>
                  {ARCHIVED.map((project) => (
                    <NavListItem key={project.id}>
                      <NavListLink
                        href={`#${project.id}`}
                        current={current === project.id}
                        onClick={go(project.id)}
                      >
                        <FolderArchiveIcon />
                        {project.name}
                      </NavListLink>
                    </NavListItem>
                  ))}
                </NavList>
              </NavListGroupContent>
            </NavListGroup>
          </NavListItem>
        </NavList>
      </nav>
    </NavListFrame>
  );
}
