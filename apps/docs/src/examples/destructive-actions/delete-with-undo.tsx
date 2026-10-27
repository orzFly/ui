import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FILES = ["report.pdf", "notes.md", "build.log"];

export function DeleteWithUndo() {
  const [files, setFiles] = useState(FILES);
  const [trash, setTrash] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1">
        {files.map((file) => (
          <li key={file} className="flex items-center gap-2 text-sm">
            <FileTextIcon className="size-4 text-muted-foreground" />
            <span className="flex-1">{file}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${file} to the trash`}
              onClick={() => {
                setFiles((list) => list.filter((f) => f !== file));
                setTrash((list) => [...list, file]);
                toast(`Moved ${file} to the trash`, {
                  action: {
                    label: "Undo",
                    onClick: () => {
                      setTrash((list) => list.filter((f) => f !== file));
                      setFiles((list) =>
                        FILES.filter((f) => f === file || list.includes(f)),
                      );
                    },
                  },
                });
              }}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
        {files.length === 0 && (
          <li className="text-muted-foreground text-sm">No files left.</li>
        )}
      </ul>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="flex-1 text-muted-foreground text-sm">
          Trash: {trash.length === 0 ? "empty" : trash.join(", ")}
        </span>
        <Button
          variant="destructive"
          disabled={trash.length === 0}
          onClick={() => setConfirming(true)}
        >
          Empty trash
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${trash.length} ${trash.length === 1 ? "file" : "files"} for good?`}
        description="Emptying the trash cannot be undone."
        confirmLabel="Delete for good"
        destructive
        onConfirm={() => {
          setTrash([]);
          setConfirming(false);
          // Their Undo would bring back files that no longer exist.
          toast.dismiss();
        }}
      />
    </div>
  );
}
