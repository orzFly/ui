import { Button } from "@orz/ui/components/button";
import { ArchiveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ArchiveToast() {
  const [selected, setSelected] = useState(3);
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm tabular-nums">{selected} selected</span>
      <Button
        variant="outline"
        disabled={selected === 0}
        onClick={() => {
          setSelected(0);
          toast("3 conversations archived", {
            action: { label: "Undo", onClick: () => setSelected(3) },
          });
        }}
      >
        <ArchiveIcon />
        Archive
      </Button>
    </div>
  );
}
