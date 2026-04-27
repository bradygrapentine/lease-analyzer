import type { Meta, StoryObj } from '@storybook/react';
import { HybridPrecisionPanel } from './HybridPrecisionPanel';
import type { HybridRuleStats } from '../audit/hybridStats';

const meta: Meta<typeof HybridPrecisionPanel> = {
  title: 'panels/HybridPrecisionPanel',
  component: HybridPrecisionPanel,
};
export default meta;

type Story = StoryObj<typeof HybridPrecisionPanel>;

export const Empty: Story = {
  args: { stats: [] },
};

const populated: HybridRuleStats[] = [
  { ruleId: 'auto-renewal', fires: 12, notRelevant: 2, precision: 1 - 2 / 12 },
  { ruleId: 'late-fee-cap', fires: 9, notRelevant: 6, precision: 1 - 6 / 9 },
  { ruleId: 'security-deposit', fires: 4, notRelevant: 0, precision: 1 },
  { ruleId: 'orphan-feedback', fires: 0, notRelevant: 1, precision: null },
];

export const Populated: Story = {
  args: { stats: populated },
};

export const SingleRule: Story = {
  args: {
    stats: [
      { ruleId: 'auto-renewal', fires: 3, notRelevant: 1, precision: 1 - 1 / 3 },
    ],
  },
};
