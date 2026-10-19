import { Button } from "./button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.tsx";

/**
 * The "leave with unsaved changes?" prompt, with no router behind it: the app
 * owns the blocker and this only renders its question. With TanStack Router,
 * one guard for the whole app (T-317) looks like this:
 *
 * ```tsx
 * function UnsavedChangesGuard() {
 *   // Both predicates keep one identity forever: useBlocker re-subscribes
 *   // whenever they change, which would churn on every keystroke.
 *   const shouldBlock = useCallback<ShouldBlockFn>(
 *     ({ current, next }) => hasUnsavedWork({ current, next }),
 *     [],
 *   );
 *   const shouldBlockUnload = useCallback(() => hasUnsavedWork(), []);
 *   const blocker = useBlocker({
 *     shouldBlockFn: shouldBlock,
 *     enableBeforeUnload: shouldBlockUnload,
 *     withResolver: true,
 *   });
 *   return (
 *     <UnsavedChangesDialog
 *       open={blocker.status === "blocked"}
 *       onProceed={() => blocker.proceed?.()}
 *       onStay={() => blocker.reset?.()}
 *     />
 *   );
 * }
 * ```
 *
 * `shouldBlockFn` is asked before an in-app navigation commits, which is the
 * last moment the work still exists; `enableBeforeUnload` hands the browser's
 * own `beforeunload` prompt the same registry (`lib/unsaved-guard`).
 */
export function UnsavedChangesDialog({
  open,
  onProceed,
  onStay,
}: {
  open: boolean;
  onProceed: () => void;
  onStay: () => void;
}) {
  return (
    <Dialog
      open={open}
      // Esc, the overlay and the close button all mean "I did not mean to
      // leave" — the navigation stays cancelled.
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave with unsaved changes?</DialogTitle>
          <DialogDescription>
            There are unsaved changes on this page. Leaving now discards them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onProceed}>
            Discard and leave
          </Button>
          <Button onClick={onStay}>Keep editing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
