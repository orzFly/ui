import { List, ListItem } from "@orz/ui/components/list";
import {
  moveItem,
  Reorder,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import { useState } from "react";

export function HandleOnly() {
  const [labels, setLabels] = useState(["Urgent", "Waiting", "Someday"]);
  return (
    <List purpose="collection" framed>
      <Reorder
        items={labels}
        onMove={(move) => setLabels((ls) => moveItem(ls, move))}
        asChild
      >
        <ul>
          {labels.map((label) => (
            <ListItem key={label} asChild>
              <ReorderItem id={label} name={label} asChild>
                <li className="flex min-h-row items-center gap-2 pr-1 touch:pr-hit-xs">
                  <ReorderHandle />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </li>
              </ReorderItem>
            </ListItem>
          ))}
        </ul>
      </Reorder>
    </List>
  );
}
