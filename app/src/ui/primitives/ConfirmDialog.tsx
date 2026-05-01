import { useId, useRef, type ReactNode } from 'react';
import { Dialog } from '../system/Dialog';
import { Button } from '../system/Button';

// Wave 58a Slice 2 — `<ConfirmDialog>` primitive.
//
// Replaces the ad-hoc `window.confirm(...)` calls scattered across the
// app with a focus-trapped, screen-reader-friendly dialog that inherits
// the WAI-ARIA APG contract from `<Dialog>`. Two tones:
//
//   - `default`     ink-on-paper confirm (e.g. archive replace prompts)
//   - `destructive` Negative-Red label per Wave 54-A token convention
//                   (DESIGN.md reserves Negative Red for the LABEL of
//                   irrecoverable actions, not the button surface).
//
// Initial focus lands on the Cancel button by default — for destructive
// flows we never want the keyboard user to muscle-memory through a
// destructive action with a single Enter press.

export type ConfirmTone = 'default' | 'destructive';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Optional supporting body copy. Renders below the title. */
  body?: ReactNode;
  confirmLabel: string;
  /** Defaults to 'Cancel'. */
  cancelLabel?: string;
  /** Defaults to 'default'. */
  confirmTone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmTone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (!open) return null;

  // Wave 54-A — destructive surface keeps the Subtle/Ghost shell and
  // tints only the LABEL. Same pattern as AppSettingsPane clear-all.
  const destructiveLabelClass =
    confirmTone === 'destructive'
      ? 'text-[var(--color-negative)] hover:text-[var(--color-negative)]'
      : '';
  const confirmVariant = confirmTone === 'destructive' ? 'ghost' : 'default';

  return (
    <Dialog
      open={open}
      onDismiss={onCancel}
      titleId={titleId}
      descriptionId={body ? descriptionId : undefined}
      initialFocusRef={cancelRef}
      closeOnEscape
    >
      <h2
        id={titleId}
        className="font-serif text-[20px] font-semibold leading-snug text-fg m-0 mb-2"
      >
        {title}
      </h2>
      {body && (
        <div
          id={descriptionId}
          className="font-serif text-body text-fg-body m-0 mb-4"
        >
          {body}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="subtle"
          size="sm"
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          size="sm"
          onClick={onConfirm}
          className={destructiveLabelClass}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
