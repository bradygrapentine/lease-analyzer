import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

const meta: Meta<typeof Dialog> = {
  title: 'System/Dialog',
  component: Dialog,
};
export default meta;
type Story = StoryObj<typeof Dialog>;

function DialogDemo({
  closeOnBackdropClick = false,
  initialFocusOnConfirm = false,
}: {
  closeOnBackdropClick?: boolean;
  initialFocusOnConfirm?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(true);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        open={open}
        onDismiss={() => setOpen(false)}
        titleId="story-dlg-title"
        descriptionId="story-dlg-desc"
        initialFocusRef={initialFocusOnConfirm ? confirmRef : undefined}
        closeOnBackdropClick={closeOnBackdropClick}
      >
        <h2 id="story-dlg-title" className="text-display font-display text-fg mb-2">
          Confirm action
        </h2>
        <p id="story-dlg-desc" className="text-body text-fg-body mb-4">
          This action cannot be undone. The lease will be removed from your library.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button ref={confirmRef} onClick={() => setOpen(false)}>
            Remove lease
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export const Default: Story = { render: () => <DialogDemo /> };
export const InitialFocusOnConfirm: Story = {
  render: () => <DialogDemo initialFocusOnConfirm />,
};
export const CloseOnBackdropClick: Story = {
  render: () => <DialogDemo closeOnBackdropClick />,
};
