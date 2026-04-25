import type { Meta, StoryObj } from '@storybook/react';
import { ShareReviewPanel } from './ShareReviewPanel';

const meta = {
  title: 'UI/ShareReviewPanel',
  component: ShareReviewPanel,
  args: {
    onGenerate: async () => new Uint8Array([1, 2, 3]),
  },
} satisfies Meta<typeof ShareReviewPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedLeaseReady: Story = {
  args: {
    lease: { id: 'lease-1', name: 'Apt 4B Lease.pdf', signedPack: true },
  },
};

export const UnsignedLeaseBlocked: Story = {
  args: {
    lease: { id: 'lease-2', name: 'Old Lease.pdf', signedPack: false },
  },
};

export const NoLeaseSelected: Story = {
  args: {
    lease: null,
  },
};
