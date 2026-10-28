import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orz/ui/components/dialog";
import { ArchiveIcon } from "lucide-react";

export function SuccessDialog() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm tabular-nums">3 selected</span>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <ArchiveIcon />
            Archive
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>3 conversations archived.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button>OK</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
