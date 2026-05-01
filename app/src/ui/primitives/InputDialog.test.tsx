import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { InputDialog } from './InputDialog';

function Harness({
  initialValue = 'old.pdf',
  onConfirm,
  onCancel,
  body,
}: {
  initialValue?: string;
  onConfirm?: (v: string) => void;
  onCancel?: () => void;
  body?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open input
      </button>
      <InputDialog
        open={open}
        title="Rename lease"
        body={body}
        inputLabel="New name"
        initialValue={initialValue}
        confirmLabel="Save"
        onConfirm={(v) => {
          onConfirm?.(v);
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

describe('InputDialog', () => {
  it('renders nothing when open is false', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, label, input seeded with initialValue, and buttons', async () => {
    const user = userEvent.setup();
    render(<Harness body="Choose a new display name." />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rename lease')).toBeInTheDocument();
    expect(screen.getByText('Choose a new display name.')).toBeInTheDocument();
    const input = screen.getByLabelText('New name') as HTMLInputElement;
    expect(input.value).toBe('old.pdf');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('omits the descriptionId association when body is not provided', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('Save fires onConfirm with the current value', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    const input = screen.getByLabelText('New name');
    await user.clear(input);
    await user.type(input, 'New.pdf');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfirm).toHaveBeenCalledWith('New.pdf');
  });

  it('Enter inside the input submits the form (onConfirm)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    const input = screen.getByLabelText('New name');
    await user.clear(input);
    await user.type(input, 'Renamed.pdf{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Renamed.pdf');
  });

  it('Cancel fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lands initial focus on the input', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(screen.getByLabelText('New name'));
  });

  it('resets value to initialValue when re-opened after a cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    const input1 = screen.getByLabelText('New name') as HTMLInputElement;
    await user.clear(input1);
    await user.type(input1, 'WIP');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'open input' }));
    const input2 = screen.getByLabelText('New name') as HTMLInputElement;
    expect(input2.value).toBe('old.pdf');
  });

  it('is axe-clean', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness body="Choose a new display name." />);
    await user.click(screen.getByRole('button', { name: 'open input' }));
    await expectAxeClean(container);
  });
});
