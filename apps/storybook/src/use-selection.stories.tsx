import { Checkbox } from "@orz/ui/components/checkbox";
import { List, ListItem } from "@orz/ui/components/list";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import { ToolbarButton, ToolbarItem } from "@orz/ui/components/toolbar";
import { useSelection } from "@orz/ui/hooks/use-selection";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { SelectionBar } from "@orz/ui/components/selection-bar";
import { useSelection } from "@orz/ui/hooks/use-selection";

function Files({ files }: { files: File[] }) {
  const keys = useMemo(() => files.map((file) => file.id), [files]);
  // A file deleted, or filtered out, leaves the selection on the same render.
  const selection = useSelection(keys);
  return (
    <>
      <SelectionBar
        count={selection.selected.length}
        total={keys.length}
        onSelectAll={selection.toggleAll}
        onClear={selection.clear}
      >
        <ToolbarButton aria-label="Delete" onClick={() => remove(selection.selected)}>
          <Trash2Icon />
        </ToolbarButton>
      </SelectionBar>
      {files.map((file) => (
        <label key={file.id}>
          <Checkbox
            checked={selection.isSelected(file.id)}
            // The click, rather than onCheckedChange, carries Shift; Space clicks too.
            onClick={(event) => selection.toggle(file.id, { extend: event.shiftKey })}
          />
          {file.name}
        </label>
      ))}
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/useSelection",
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const FILES = [
  "brief.md",
  "budget.xlsx",
  "cover.png",
  "draft-1.docx",
  "draft-2.docx",
  "invoice.pdf",
  "notes.txt",
];

/**
 * Click a box, then Shift-click another: every row between takes the second one's new state.
 * Delete the selection and it is gone from the count at once, as a row filtered out would be.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const [files, setFiles] = useState(FILES);
    const selection = useSelection(files);
    return (
      <List purpose="listbox" framed>
        <SelectionBar
          edge="bottom"
          count={selection.selected.length}
          total={files.length}
          onSelectAll={selection.toggleAll}
          onClear={selection.clear}
          idle={
            <>
              <ToolbarItem flex minWidth={80}>
                <span className="truncate px-1 font-medium">
                  {files.length} files
                </span>
              </ToolbarItem>
              <ToolbarButton
                aria-label="Put the files back"
                onClick={() => setFiles(FILES)}
              >
                <RotateCcwIcon />
              </ToolbarButton>
            </>
          }
        >
          <ToolbarButton
            aria-label="Delete"
            onClick={() =>
              setFiles((was) =>
                was.filter((file) => !selection.isSelected(file)),
              )
            }
          >
            <Trash2Icon />
          </ToolbarButton>
        </SelectionBar>
        <ul className="p-1">
          {files.map((file) => (
            <ListItem key={file} selected={selection.isSelected(file)} asChild>
              <li>
                <label
                  htmlFor={`file-${file}`}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
                >
                  <Checkbox
                    id={`file-${file}`}
                    checked={selection.isSelected(file)}
                    onClick={(event) =>
                      selection.toggle(file, { extend: event.shiftKey })
                    }
                  />
                  {file}
                </label>
              </li>
            </ListItem>
          ))}
        </ul>
      </List>
    );
  },
};
