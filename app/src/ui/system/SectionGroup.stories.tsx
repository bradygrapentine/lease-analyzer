import type { Meta, StoryObj } from '@storybook/react';
import { SectionGroup } from './SectionGroup';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof SectionGroup> = {
  title: 'System/SectionGroup',
  component: SectionGroup,
};
export default meta;
type Story = StoryObj<typeof SectionGroup>;

export const OpenWithCount: Story = {
  args: {
    id: 'this-lease',
    title: 'This lease',
    count: 8,
    defaultOpen: true,
    children: (
      <div className="text-body font-sans text-fg-body">
        Lease facts, annotations, and export controls live here.
      </div>
    ),
  },
};

export const CollapsedNoCount: Story = {
  args: {
    id: 'governance',
    title: 'Governance',
    defaultOpen: false,
    children: <div>Hidden by default</div>,
  },
};

export const Compact: Story = {
  args: {
    id: 'library',
    title: 'Library',
    count: '3 pending',
    defaultOpen: true,
    density: 'compact',
    children: <div>Compact density example</div>,
  },
};

export const WithEmptyStateInside: Story = {
  args: {
    id: 'library',
    title: 'Library',
    count: 0,
    defaultOpen: true,
    children: (
      <EmptyState
        title="No leases yet"
        description="Drop a PDF here or use the Upload button above to get started."
      />
    ),
  },
};
