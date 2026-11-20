import { render } from "@testing-library/react";
import { vi } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import {
  type StagedFiles,
  type StagedUpload,
  stagedFileDrag,
  useStagedFiles,
} from "../src/hooks/use-staged-files.ts";
import { cmDropFiles, cmGetValue, cmPasteFiles, cmView } from "./cm.ts";

/**
 * An editor wired to the hook, with the smallest tray a test can read: one
 * draggable item per staged file, titled with its name, and its remove
 * button.
 */
export function mountStaging(
  options: {
    initialValue?: string;
    autoFocus?: boolean;
    plain?: boolean;
    upload?: (file: File) => Promise<StagedUpload>;
  } = {},
) {
  const upload = vi.fn(
    options.upload ??
      ((file: File) =>
        Promise.resolve({ url: `https://files.example/${file.name}` })),
  );
  const withdraw = vi.fn();
  let latest: StagedFiles | null = null;
  function Harness() {
    const staging = useStagedFiles({ upload, withdraw });
    latest = staging;
    return (
      <>
        <MarkdownEditor
          initialValue={options.initialValue}
          autoFocus={options.autoFocus}
          plain={options.plain}
          staging={staging.editor}
        />
        <ul>
          {staging.staged.map((item) => (
            <li key={item.key} title={item.file.name}>
              <span data-drag={item.file.name} {...stagedFileDrag(item.key)} />
              <button
                type="button"
                aria-label={`remove ${item.file.name}`}
                onClick={() => staging.remove(item.key)}
              />
            </li>
          ))}
        </ul>
      </>
    );
  }
  const view = render(<Harness />);
  const root = view.container;
  return {
    root,
    upload,
    withdraw,
    hook: () => latest as StagedFiles,
    cm: () => cmView(root),
    text: () => cmGetValue(root),
    unmount: view.unmount,
  };
}

export type MountedStaging = ReturnType<typeof mountStaging>;

export function pasteFiles(mounted: MountedStaging, ...files: File[]): Event {
  return cmPasteFiles(mounted.root, files);
}

export function dropFiles(mounted: MountedStaging, ...files: File[]): Event {
  return cmDropFiles(mounted.root, files);
}
