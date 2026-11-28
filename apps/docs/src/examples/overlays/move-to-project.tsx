import { PROJECTS } from "@orz/fixtures/projects.ts";
import { TASKS } from "@orz/fixtures/tasks.ts";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { MatchedText, matchText } from "@orz/ui/components/filter-menu";
import { List, ListItem } from "@orz/ui/components/list";
import { EllipsisIcon } from "lucide-react";
import { useState } from "react";

const START = TASKS.slice(0, 3).map((task, i) => ({
  id: task.id,
  title: task.title,
  project: PROJECTS[i * 4]?.key ?? "",
}));

export function MoveToProject() {
  const [tasks, setTasks] = useState(START);
  // One query serves every row's menu: one opens at a time, and each
  // opening of the submenu clears it.
  const [query, setQuery] = useState("");
  const shown = PROJECTS.filter(
    (project) =>
      matchText(project.name, query) || matchText(project.key, query),
  );
  return (
    <List purpose="collection" framed className="max-w-lg">
      <ul>
        {tasks.map((task) => (
          <ListItem key={task.id} asChild>
            <li className="flex min-h-row items-center gap-2 pr-1 pl-3 text-ui">
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="text-ui-sm text-muted-foreground">
                {task.project}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`More actions for “${task.title}”`}
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>Edit…</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      Move to project
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      query={query}
                      onQueryChange={setQuery}
                      placeholder="Filter projects…"
                      inputLabel="Filter projects"
                    >
                      <DropdownMenuRadioGroup
                        value={task.project}
                        onValueChange={(key) =>
                          setTasks((all) =>
                            all.map((t) =>
                              t.id === task.id ? { ...t, project: key } : t,
                            ),
                          )
                        }
                      >
                        {shown.map((project) => (
                          <DropdownMenuRadioItem
                            key={project.key}
                            value={project.key}
                          >
                            <MatchedText text={project.name} query={query} />
                            <span className="ml-auto text-ui-sm text-muted-foreground">
                              <MatchedText text={project.key} query={query} />
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ListItem>
        ))}
      </ul>
    </List>
  );
}
