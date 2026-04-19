import type { Meta, StoryObj } from '@storybook/react';
import { LibraryPanel } from './LibraryPanel';
import type { LeaseMetadata } from '../storage/storage';

const leases: LeaseMetadata[] = [
  {
    id: 'lease-std',
    name: 'Standard Lease 2024',
    createdAt: new Date('2026-01-15').getTime(),
    updatedAt: new Date('2026-01-15').getTime(),
    rulePackVersion: 'v1',
    pageCount: 8,
    findingCount: 3,
  },
  {
    id: 'lease-renewal',
    name: 'Renewal Draft 2026',
    createdAt: new Date('2026-03-02').getTime(),
    updatedAt: new Date('2026-03-02').getTime(),
    rulePackVersion: 'v1',
    pageCount: 12,
    findingCount: 7,
  },
  {
    id: 'lease-solo',
    name: 'One-off Month-to-Month',
    createdAt: new Date('2026-04-01').getTime(),
    updatedAt: new Date('2026-04-01').getTime(),
    rulePackVersion: 'v1',
    pageCount: 4,
    findingCount: 1,
  },
];

const meta = {
  title: 'UI/LibraryPanel',
  component: LibraryPanel,
  args: {
    onOpen: () => {},
    onDelete: () => {},
    onSetStandard: () => {},
    onRename: () => {},
  },
} satisfies Meta<typeof LibraryPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    leases: [],
    standardId: null,
  },
};

export const WithStandardMarked: Story = {
  args: {
    leases,
    standardId: 'lease-std',
  },
};
