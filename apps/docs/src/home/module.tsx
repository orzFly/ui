import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { cn } from "@orz/ui/lib/utils";
import type { ReactNode } from "react";
import { BASE } from "../router.tsx";
import { storybookHref } from "../routes.ts";

/**
 * One module of the home page's mosaic: a card under a strip with the marker
 * and the title, then at its end the components it is built from, each
 * linking to its Storybook page, and the action.
 */
export function HomeModule({
  icon,
  title,
  api = [],
  action,
  className,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  /** Storybook titles of the components the module is built from. */
  api?: readonly string[];
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <CardHeader icon={icon}>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {(api.length > 0 || action) && (
          <CardAction className="gap-3">
            {api.length > 0 && (
              <span data-pagefind-ignore className="text-muted-foreground">
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
              </span>
            )}
            {action}
          </CardAction>
        )}
      </CardHeader>
      {children}
    </Card>
  );
}
