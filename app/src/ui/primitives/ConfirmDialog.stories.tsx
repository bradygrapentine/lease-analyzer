import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Primitives/ConfirmDialog',
  component: ConfirmDialog,
};
export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

function Demo({
  tone,
  title,
  body,
  confirmLabel,
}: {
  tone: 'default' | 'destructive';
  title: string;
  body?: string;
  confirmLabel: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open confirm
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        confirmTone={tone}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <Demo
      tone="default"
      title="Replace current library?"
      body="The 3 lease(s) in this archive will replace what you have today."
      confirmLabel="Replace"
    />
  ),
};

export const Destructive: Story = {
  render: () => (
    <Demo
      tone="destructive"
      title="Clear all 12 redline edits?"
      body="This cannot be undone."
      confirmLabel="Clear all"
    />
  ),
};
