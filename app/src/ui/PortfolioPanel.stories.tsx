import type { Meta, StoryObj } from '@storybook/react';
import { PortfolioPanel } from './PortfolioPanel';
import type { LeaseMetadata } from '../storage/storage';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'rule',
    severity: 'medium',
    category: 'general',
    title: 'Rule',
    explanation: 'e',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start: 0, end: 1 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

const leases: LeaseMetadata[] = [
  {
    id: 'lease-a',
    name: 'Unit 4B.pdf',
    createdAt: new Date('2026-01-15').getTime(),
    updatedAt: new Date('2026-01-15').getTime(),
    rulePackVersion: 'v1',
    pageCount: 8,
    findingCount: 3,
  },
  {
    id: 'lease-b',
    name: 'Unit 7A.pdf',
    createdAt: new Date('2026-02-02').getTime(),
    updatedAt: new Date('2026-02-02').getTime(),
    rulePackVersion: 'v1',
    pageCount: 11,
    findingCount: 4,
  },
  {
    id: 'lease-c',
    name: 'Sublease offer.pdf',
    createdAt: new Date('2026-03-12').getTime(),
    updatedAt: new Date('2026-03-12').getTime(),
    rulePackVersion: 'v1',
    pageCount: 6,
    findingCount: 2,
  },
];

const findingsByLease = new Map<string, Finding[]>([
  [
    'lease-a',
    [
      f({ ruleId: 'auto-renew', severity: 'high' }),
      f({ ruleId: 'late-fees', severity: 'medium' }),
      f({ ruleId: 'arbitration', severity: 'high' }),
    ],
  ],
  [
    'lease-b',
    [
      f({ ruleId: 'auto-renew', severity: 'high' }),
      f({ ruleId: 'late-fees', severity: 'high' }),
      f({ ruleId: 'entry-notice', severity: 'low' }),
      f({ ruleId: 'pet-fee', severity: 'medium' }),
    ],
  ],
  [
    'lease-c',
    [
      f({ ruleId: 'auto-renew', severity: 'medium' }),
      f({ ruleId: 'liability-waiver', severity: 'high' }),
    ],
  ],
]);

const meta = {
  title: 'UI/PortfolioPanel',
  component: PortfolioPanel,
  args: {
    onOpenLease: () => {},
  },
} satisfies Meta<typeof PortfolioPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    leases: [],
    findingsByLease: new Map(),
  },
};

export const ThreeLeases: Story = {
  args: {
    leases,
    findingsByLease,
  },
};
