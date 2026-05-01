import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { InputDialog } from './InputDialog';

const meta: Meta<typeof InputDialog> = {
  title: 'Primitives/InputDialog',
  component: InputDialog,
};
export default meta;
type Story = StoryObj<typeof InputDialog>;

function Demo({
  title,
  body,
  inputLabel,
  initialValue,
  confirmLabel,
}: {
  title: string;
  body?: string;
  inputLabel: string;
  initialValue?: string;
  confirmLabel: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open input
      </button>
      <InputDialog
        open={open}
        title={title}
        body={body}
        inputLabel={inputLabel}
        initialValue={initialValue}
        confirmLabel={confirmLabel}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export const RenameLease: Story = {
  render: () => (
    <Demo
      title="Rename lease"
      inputLabel="New name"
      initialValue="downtown-loft.pdf"
      confirmLabel="Save"
    />
  ),
};

export const WithBody: Story = {
  render: () => (
    <Demo
      title="Rename lease"
      body="The new name shows up in the library and in audit log entries."
      inputLabel="New name"
      initialValue="downtown-loft.pdf"
      confirmLabel="Save"
    />
  ),
};
