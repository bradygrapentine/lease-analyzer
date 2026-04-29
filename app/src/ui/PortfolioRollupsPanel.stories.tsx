import type { Meta, StoryObj } from '@storybook/react';
import { PortfolioRollupsPanel } from './PortfolioRollupsPanel';
import type { RuleRollup } from '../portfolio/ruleRollups';

const SAMPLE: RuleRollup[] = [
  {
    ruleId: 'auto-renewal',
    leaseCount: 3,
    severityCounts: { high: 1, medium: 2, low: 0, info: 0 },
    leaseIds: ['L1', 'L2', 'L3'],
  },
  {
    ruleId: 'holdover',
    leaseCount: 2,
    severityCounts: { high: 0, medium: 0, low: 2, info: 0 },
    leaseIds: ['L1', 'L2'],
  },
  {
    ruleId: 'notice',
    leaseCount: 1,
    severityCounts: { high: 0, medium: 0, low: 0, info: 1 },
    leaseIds: ['L3'],
  },
];

const meta = {
  title: 'UI/PortfolioRollupsPanel',
  component: PortfolioRollupsPanel,
  args: {
    onDrillThrough: (ids: string[]) => {
      console.log('[stories] drill-through', ids);
    },
  },
} satisfies Meta<typeof PortfolioRollupsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { rollups: [] },
};

export const Loaded: Story = {
  args: { rollups: SAMPLE },
};

export const SingleRule: Story = {
  args: {
    rollups: [
      {
        ruleId: 'auto-renewal',
        leaseCount: 1,
        severityCounts: { high: 1, medium: 0, low: 0, info: 0 },
        leaseIds: ['L1'],
      },
    ],
  },
};
