import type { ComponentType } from "react";

export interface ExampleSource {
  /** The file's text. */
  source: string;
  /** Its name, `profile-form.tsx`. */
  file: string;
}

// Filled by the orz-docs:example-source plugin, which appends a call to each
// file under examples/ with that file's own `?raw` import: the code a reader
// copies is the code that ran.
const sources = new WeakMap<ComponentType, ExampleSource>();

export function registerExampleSource(
  component: ComponentType,
  source: string,
  file: string,
) {
  sources.set(component, { source, file });
}

export function exampleSource(
  component: ComponentType,
): ExampleSource | undefined {
  return sources.get(component);
}
