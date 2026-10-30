import { Card } from "@orz/ui/components/card";
import { cn } from "@orz/ui/lib/utils";
import { Command, installOf, LinkButton } from "../mdx.tsx";

/** The page's title: no strip and no marker, since it is not a module of a tool. */
export function Hero({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "min-w-0 justify-center gap-0 px-5 py-8 md:px-8 lg:px-10 lg:py-10",
        className,
      )}
    >
      <p className="text-muted-foreground text-ui">
        A UI library by AI, for AI.
      </p>
      <h1 className="mt-3 max-w-[20ch] text-balance font-semibold text-4xl tracking-tight md:text-5xl">
        Components for tools people live in all day.
      </h1>
      <p className="mt-5 max-w-[62ch] text-base text-muted-foreground leading-7">
        React and Tailwind CSS v4 components, a theme store, and viewers for
        what tools produce. Every module on this page is one of them, at work.
        Dense with a mouse, generous with a thumb.
      </p>
      <div className="mt-6 max-w-full font-mono" data-pagefind-ignore>
        <Command command={installOf("@orz/ui").command} />
      </div>
      <div className="mt-6 flex flex-wrap gap-2" data-pagefind-ignore>
        <LinkButton to="/start/">Get started</LinkButton>
        <LinkButton to="/storybook/" variant="outline">
          Browse components
        </LinkButton>
      </div>
    </Card>
  );
}
