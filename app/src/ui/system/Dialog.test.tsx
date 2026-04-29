import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { Dialog } from './Dialog';

function Harness({
  closeOnBackdropClick = false,
  withInitialFocusRef = false,
}: {
  closeOnBackdropClick?: boolean;
  withInitialFocusRef?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open dialog
      </button>
      <Dialog
        open={open}
        onDismiss={() => setOpen(false)}
        titleId="dlg-title"
        descriptionId="dlg-desc"
        initialFocusRef={withInitialFocusRef ? initialFocusRef : undefined}
        closeOnBackdropClick={closeOnBackdropClick}
      >
        <h2 id="dlg-title">Confirm action</h2>
        <p id="dlg-desc">This action cannot be undone.</p>
        <button type="button">Cancel</button>
        <button type="button" ref={initialFocusRef}>
          Confirm
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('renders nothing when open is false', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog with aria-modal + labelledby + describedby when open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dlg-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'dlg-desc');
  });

  it('moves focus into the dialog on mount (defaults to dialog root)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    // Microtask deferred — wait for it.
    await act(async () => {
      await Promise.resolve();
    });
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
  });

  it('honors initialFocusRef when provided', async () => {
    const user = userEvent.setup();
    render(<Harness withInitialFocusRef />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm' }));
  });

  it('Esc dismisses by default', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the trigger after dismiss', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'open dialog' });
    await user.click(trigger);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).not.toBe(trigger);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab cycles within the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await act(async () => {
      await Promise.resolve();
    });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const close = screen.getByRole('button', { name: 'Close' });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    // Tab through Cancel → Confirm → Close → wraps back to Cancel
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
  });

  it('backdrop click dismisses only when closeOnBackdropClick is true', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    // Find the fixed backdrop (the outer flex container).
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeInTheDocument(); // default: no dismiss
    rerender(<Harness closeOnBackdropClick />);
    // The first dialog is still open; close it via Esc and reopen with new prop.
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    const newDialog = screen.getByRole('dialog');
    const newBackdrop = newDialog.parentElement as HTMLElement;
    await user.click(newBackdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await expectAxeClean(container);
  });
});
