import { Pane } from "@orz/ui/components/pane";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@orz/ui/components/toolbar";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
} from "lucide-react";
import { useState } from "react";

const ALIGN = [
  { value: "left", label: "Align left", Icon: AlignLeftIcon },
  { value: "center", label: "Align center", Icon: AlignCenterIcon },
  { value: "right", label: "Align right", Icon: AlignRightIcon },
];

export function ViewAndAlignment() {
  const [view, setView] = useState("page");
  const [align, setAlign] = useState("left");
  const [marks, setMarks] = useState<string[]>([]);
  return (
    <Pane
      purpose="panel"
      frame="inset"
      className="w-lg min-w-40 max-w-full resize-x overflow-hidden"
    >
      <Toolbar aria-label="Document" className="px-2 py-1.5">
        <SegmentedControl
          aria-label="View"
          value={view}
          onValueChange={setView}
        >
          <SegmentedControlItem value="page">Page</SegmentedControlItem>
          <SegmentedControlItem value="outline">Outline</SegmentedControlItem>
          <SegmentedControlItem value="source">Source</SegmentedControlItem>
        </SegmentedControl>
        <ToolbarSeparator decorative={false} />
        <ToolbarGroup
          label="Text style"
          selection="multiple"
          value={marks}
          onValueChange={setMarks}
        >
          <ToolbarButton value="bold" aria-label="Bold">
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton value="italic" aria-label="Italic">
            <ItalicIcon />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator decorative={false} />
        <ToolbarGroup
          label="Alignment"
          selection="single"
          value={align}
          onValueChange={setAlign}
        >
          {ALIGN.map(({ value, label, Icon }) => (
            <ToolbarButton key={value} value={value} aria-label={label}>
              <Icon />
            </ToolbarButton>
          ))}
        </ToolbarGroup>
      </Toolbar>
    </Pane>
  );
}
