import type { Meta, StoryObj } from '@storybook/react';
import { SeverityOverridesPanel } from './SeverityOverridesPanel';

const RULES = [
  { id: 'auto-renew', title: 'Auto-renewal clause', severity: 'warn' as const },
  { id: 'holdover', title: 'Holdover penalty', severity: 'error' as const },
  { id: 'notice', title: 'Notice-to-enter requirement', severity: 'info' as const },
  { id: 'subletting', title: 'Subletting restriction', severity: 'warn' as const },
];

const meta = {
  title: 'UI/SeverityOverridesPanel',
  component: SeverityOverridesPanel,
  args: {
    onChange: () => {},
  },
} satisfies Meta<typeof SeverityOverridesPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    rules: [],
    overrides: {},
  },
};

export const NoOverrides: Story = {
  args: {
    rules: RULES,
    overrides: {},
  },
};

export const MixedOverrides: Story = {
  args: {
    rules: RULES,
    // `notice` kept as built-in; others overridden in both directions.
    overrides: {
      'auto-renew': 'error',
      holdover: 'info',
    },
  },
};
