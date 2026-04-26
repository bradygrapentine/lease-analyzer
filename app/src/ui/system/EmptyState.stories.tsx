import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'System/EmptyState',
  component: EmptyState,
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

const FolderIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    width="32"
    height="32"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export const TitleOnly: Story = {
  args: { title: 'No leases yet' },
};

export const WithDescription: Story = {
  args: {
    title: 'No clause templates saved yet',
    description: 'Save a snippet from a lease to build your reusable clause library.',
  },
};

export const WithIconAndAction: Story = {
  args: {
    title: 'No leases yet',
    description: 'Drop a PDF here or use the Upload button above to get started.',
    icon: FolderIcon,
    action: (
      <button
        type="button"
        className="border border-rule rounded-sm bg-paper-raised px-3 py-1 text-body font-sans text-fg hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] focus-visible:focus-ring"
      >
        Upload a lease
      </button>
    ),
  },
};
