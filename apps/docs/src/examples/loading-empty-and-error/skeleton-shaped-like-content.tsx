import { NOTE_FOLDERS } from "@orz/fixtures/notes.ts";
import {
  NavList,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { Skeleton } from "@orz/ui/components/skeleton";

export function SkeletonShapedLikeContent() {
  return (
    <Pane
      purpose="app"
      frame="card"
      className="grid grid-cols-[6rem_1fr] overflow-hidden"
    >
      <Pane purpose="sidebar" edge="end" className="min-w-0 p-2">
        <NavListFrame asChild>
          <nav aria-label="Folders">
            <NavList>
              {NOTE_FOLDERS.map((folder) => (
                <NavListItem key={folder}>
                  <NavListLink asChild className="px-1.5">
                    <button type="button">
                      <span className="truncate">{folder}</span>
                    </button>
                  </NavListLink>
                </NavListItem>
              ))}
            </NavList>
          </nav>
        </NavListFrame>
      </Pane>
      <Pane purpose="document" className="min-w-0">
        <ul aria-label="Loading notes" className="grid content-start gap-3 p-3">
          {[0, 1, 2].map((row) => (
            <li key={row} className="grid gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </li>
          ))}
        </ul>
      </Pane>
    </Pane>
  );
}
