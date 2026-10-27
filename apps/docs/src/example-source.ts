import type { ComponentType } from "react";

// Filled by the orz-docs:example-source plugin, which appends a call to each
// file under examples/ with that file's own `?raw` import: the code a reader
// copies is the code that ran.
const sources = new WeakMap<ComponentType, string>();

export function registerExampleSource(
  component: ComponentType,
  source: string,
) {
  sources.set(component, source);
}

export function exampleSource(component: ComponentType): string | undefined {
  return sources.get(component);
}
