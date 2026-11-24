import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { cn } from "@orz/ui/lib/utils";
import type { ReactNode } from "react";
import { BASE } from "../router.tsx";
import { storybookHref } from "../routes.ts";

/**
 * One module of the home page's mosaic: a card under a strip with the marker,
 * the title, a quiet line and the components it is built from, each linking to
 * its Storybook page.
 */
export function HomeModule({
  icon,
  title,
  meta,
  api = [],
  action,
  className,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  /** A few quiet words after the title. */
  meta?: ReactNode;
  /** Storybook titles of the components the module is built from. */
  api?: readonly string[];
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      {/* A long title wraps the action under the API links. On touch the two
          lines stand apart by what a line of links and a small button leave
          of the touch spacing, so a link and the button share no tap. */}
      <CardHeader
        icon={icon}
        className="touch:gap-y-[calc(var(--spacing-touch)-(var(--text-ui-sm--line-height)+var(--spacing-control-xs))/2)]"
      >
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {(meta !== undefined || api.length > 0) && (
          <CardDescription data-pagefind-ignore>
            {meta}
            {meta !== undefined && api.length > 0 && " · "}
            {api.map((storyTitle, index) => (
              <span key={storyTitle}>
                {index > 0 && " · "}
                <a
                  href={storybookHref(BASE, storyTitle)}
                  className="hover:text-foreground hover:underline"
                >
                  {storyTitle.split("/").at(-1)}
                </a>
              </span>
            ))}
          </CardDescription>
        )}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {children}
    </Card>
  );
}
