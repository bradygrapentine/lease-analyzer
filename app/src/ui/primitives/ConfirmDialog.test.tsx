import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog';

function Harness({
  tone = 'default',
  onConfirm,
  onCancel,
  body,
}: {
  tone?: ConfirmTone;
  onConfirm?: () => void;
  onCancel?: () => void;
  body?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open confirm
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this thing?"
        body={body}
        confirmLabel="Delete"
        confirmTone={tone}
        onConfirm={() => {
          onConfirm?.();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel?.();
          setOpen(false);
        }}
      />
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, body, and confirm/cancel buttons when open', async () => {
    const user = userEvent.setup();
    render(<Harness body="This action cannot be undone." />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this thing?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('omits the descriptionId association when body is not provided', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('clicking confirm fires onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clicking cancel fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lands initial focus on Cancel (destructive flows must not auto-arm Enter)', async () => {
    const user = userEvent.setup();
    render(<Harness tone="destructive" />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('Tab cycles between Cancel and Delete (focus trap)', async () => {
    const user = userEvent.setup();
    render(<Harness tone="destructive" />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await act(async () => {
      await Promise.resolve();
    });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(cancel);
    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
  });

  it('destructive tone applies the Negative-Red label class to the confirm button', async () => {
    const user = userEvent.setup();
    render(<Harness tone="destructive" />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.className).toContain('var(--color-negative)');
  });

  it('default tone does not apply the Negative-Red class', async () => {
    const user = userEvent.setup();
    render(<Harness tone="default" />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.className).not.toContain('var(--color-negative)');
  });

  it('is axe-clean', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness body="Confirm before continuing." />);
    await user.click(screen.getByRole('button', { name: 'open confirm' }));
    await expectAxeClean(container);
  });
});
