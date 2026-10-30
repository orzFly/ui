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
 * The home page's modules, tiled edge to edge: twelve columns at lg, six at
 * md, one on a phone in reading order. `children` follow the first viewport's
 * modules, each spanning the full width.
 */
export function HomeMosaic({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-2xl px-3 py-4 md:px-5 md:py-5">
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12">
        <Hero className="md:col-span-6 lg:row-span-2" />
        <YourTheme className="md:col-span-3" />
        <ForAgents className="md:col-span-3" />
        <TasksModule className="md:col-span-6" />
        <CiLogModule className="md:col-span-6 lg:col-span-4" />
        <DiffModule className="md:col-span-3 lg:col-span-4" />
        <TerminalModule className="md:col-span-3 lg:col-span-4" />
        {children}
      </div>
    </div>
  );
}
