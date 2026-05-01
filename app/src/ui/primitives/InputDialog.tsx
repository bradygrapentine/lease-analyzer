import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../system/Dialog';
import { Button } from '../system/Button';

// Wave 58a Slice 3 — `<InputDialog>` primitive.
//
// Sibling to `<ConfirmDialog>`: same chrome (focus trap, Escape, scrim,
// WAI-ARIA APG dialog contract) but adds a labeled text field. Replaces
// ad-hoc `window.prompt(...)` calls — currently only LibraryPanel's
// rename flow.
//
// Initial focus lands on the input (with the seed value selected) so a
// keyboard user can immediately type a replacement or press Enter to
// keep the seed.

interface InputDialogProps {
  open: boolean;
  title: string;
  /** Optional supporting body copy. Renders below the title. */
  body?: ReactNode;
  /** Visible label for the text field. */
  inputLabel: string;
  /** Initial input value when the dialog opens. */
  initialValue?: string;
  confirmLabel: string;
  /** Defaults to 'Cancel'. */
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  open,
  title,
  body,
  inputLabel,
  initialValue = '',
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: InputDialogProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  // Reset the input each time the dialog re-opens so a stale prior edit
  // never leaks into a fresh rename.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  // Select-on-focus so the user can immediately overtype the seed.
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => inputRef.current?.select());
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    onConfirm(value);
  }

  return (
    <Dialog
      open={open}
      onDismiss={onCancel}
      titleId={titleId}
      descriptionId={body ? descriptionId : undefined}
      initialFocusRef={inputRef}
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
      <form onSubmit={handleSubmit}>
        <label
          id={labelId}
          htmlFor={`${labelId}-input`}
          className="block text-small text-fg-muted mb-1"
        >
          {inputLabel}
        </label>
        <input
          id={`${labelId}-input`}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-rule rounded-sm px-2 py-1 text-body bg-paper text-fg focus-visible:focus-ring"
        />
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="subtle" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant="default" size="sm">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
