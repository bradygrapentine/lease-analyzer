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

// Side-by-side preview of all four severities — the canonical going-forward
// severity treatment per DESIGN.md §5: tinted bg + ink-on-tint + icon + label.
export const SeverityRow: Story = {
  render: () => (
    <div className="inline-flex items-center gap-2">
      <Badge variant="severity" severity="high">
        High
      </Badge>
      <Badge variant="severity" severity="medium">
        Medium
      </Badge>
      <Badge variant="severity" severity="low">
        Low
      </Badge>
      <Badge variant="severity" severity="info">
        Info
      </Badge>
    </div>
  ),
};
