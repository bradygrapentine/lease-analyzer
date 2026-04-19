import type { Meta, StoryObj } from '@storybook/react';
import { ComparePanel } from './ComparePanel';
import type { Finding } from '../rules/types';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-base',
    severity: 'medium',
    category: 'general',
    title: 'Generic finding',
    explanation: 'Explanation.',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 10 },
    confidence: 0.8,
    negated: false,
    rulePackVersion: 'v1',
    ...overrides,
  };
}

// Same rule set in both -> no diffs.
const identical: Finding[] = [
  makeFinding({ ruleId: 'r-auto-renew', title: 'Auto-renewal', severity: 'high' }),
  makeFinding({ ruleId: 'r-late-fee', title: 'Late fee', severity: 'medium' }),
];

// A-side (old): has r-auto-renew (high) and r-late-fee (medium).
const aSide: Finding[] = [
  makeFinding({ ruleId: 'r-auto-renew', title: 'Auto-renewal', severity: 'high' }),
  makeFinding({ ruleId: 'r-late-fee', title: 'Late fee', severity: 'medium' }),
  makeFinding({ ruleId: 'r-arbitration', title: 'Arbitration', severity: 'medium' }),
];

// B-side (new): removes arbitration, adds pet-fee, late-fee escalated to high.
const bSide: Finding[] = [
  makeFinding({ ruleId: 'r-auto-renew', title: 'Auto-renewal', severity: 'high' }),
  makeFinding({ ruleId: 'r-late-fee', title: 'Late fee (escalated)', severity: 'high' }),
  makeFinding({ ruleId: 'r-pet-fee', title: 'Non-refundable pet fee', severity: 'low' }),
];

const meta = {
  title: 'UI/ComparePanel',
  component: ComparePanel,
} satisfies Meta<typeof ComparePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoDifferences: Story = {
  args: {
    aName: 'Standard Lease 2024',
    bName: 'Standard Lease 2024 (copy)',
    aFindings: identical,
    bFindings: identical,
  },
};

export const MixedDiff: Story = {
  args: {
    aName: 'Standard Lease 2024',
    bName: 'Renewal Draft 2026',
    aFindings: aSide,
    bFindings: bSide,
  },
};
