import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'System/Badge',
  component: Badge,
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };
export const SeverityHigh: Story = {
  args: { variant: 'severity', severity: 'high', children: 'High' },
};
export const SeverityMedium: Story = {
  args: { variant: 'severity', severity: 'medium', children: 'Medium' },
};
export const SeverityLow: Story = {
  args: { variant: 'severity', severity: 'low', children: 'Low' },
};
export const SeverityInfo: Story = {
  args: { variant: 'severity', severity: 'info', children: 'Info' },
};
export const Mono: Story = { args: { variant: 'mono', children: 'analyze' } };
