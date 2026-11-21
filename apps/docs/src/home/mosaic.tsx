import { ModuleGrid } from "@orz/ui/components/card";
import type { ReactNode } from "react";
import {
  CiLogModule,
  DiffModule,
  TasksModule,
  TerminalModule,
} from "./at-work.tsx";
import { ForAgents } from "./for-agents.tsx";
import { Hero } from "./hero.tsx";
import { YourTheme } from "./your-theme.tsx";

/**
 * The home page's modules, a module gap apart: twelve columns at lg, six at
 * md, one on a phone in reading order. `children` follow the first viewport's
 * modules, each spanning the full width.
 */
export function HomeMosaic({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-2xl">
      <ModuleGrid className="md:grid-cols-6 lg:grid-cols-12">
        <Hero className="md:col-span-6 lg:row-span-2" />
        <YourTheme className="md:col-span-3" />
        <ForAgents className="md:col-span-3" />
        <TasksModule className="md:col-span-6" />
        <CiLogModule className="md:col-span-6 lg:col-span-4" />
        <DiffModule className="md:col-span-3 lg:col-span-4" />
        <TerminalModule className="md:col-span-3 lg:col-span-4" />
        {children}
      </ModuleGrid>
    </div>
  );
}
