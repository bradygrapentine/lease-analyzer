import type { Meta, StoryObj } from '@storybook/react';
import { LibraryCompareForm } from './LibraryCompareForm';
import type { LeaseMetadata } from '../storage/storage';

const oneLease: LeaseMetadata[] = [
  {
    id: 'lease-1',
    name: 'Only Lease',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rulePackVersion: 'v1',
    pageCount: 4,
    findingCount: 2,
  },
];

const multiple: LeaseMetadata[] = [
  {
    id: 'lease-a',
    name: 'Standard Lease 2024',
    createdAt: new Date('2026-01-01').getTime(),
    updatedAt: new Date('2026-01-01').getTime(),
    rulePackVersion: 'v1',
    pageCount: 8,
    findingCount: 3,
  },
  {
    id: 'lease-b',
    name: 'Renewal Draft 2026',
    createdAt: new Date('2026-03-01').getTime(),
    updatedAt: new Date('2026-03-01').getTime(),
    rulePackVersion: 'v1',
    pageCount: 10,
    findingCount: 5,
  },
  {
    id: 'lease-c',
    name: 'Commercial Sublease',
    createdAt: new Date('2026-02-15').getTime(),
    updatedAt: new Date('2026-02-15').getTime(),
    rulePackVersion: 'v1',
    pageCount: 22,
    findingCount: 11,
  },
];

const meta = {
  title: 'UI/LibraryCompareForm',
  component: LibraryCompareForm,
  args: {
    onCompare: () => {},
  },
} satisfies Meta<typeof LibraryCompareForm>;

export default meta;

type Story = StoryObj<typeof meta>;

// Fewer than 2 leases -> renders null. Story documents the empty contract.
export const TooFewLeases: Story = {
  args: {
    leases: oneLease,
  },
};

export const MultipleLeases: Story = {
  args: {
    leases: multiple,
  },
};
