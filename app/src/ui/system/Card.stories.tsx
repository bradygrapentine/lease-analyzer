import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Badge } from './Badge';

const meta: Meta<typeof Card> = {
  title: 'System/Card',
  component: Card,
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { children: 'Default card content', className: 'p-3' },
};
export const WithLabel: Story = {
  args: {
    'aria-label': 'selected finding',
    children: 'Card rendered as article',
    className: 'p-3',
  },
};

// Wave 45-A — severity row variants. Tinted bg + matching low-alpha border
// (full perimeter, NOT a side stripe), paired with a leading <Badge> so the
// row carries icon + label per the Severity-Earned doctrine.
export const SeverityHigh: Story = {
  render: () => (
    <Card variant="severity-high" className="p-3 space-y-1" aria-label="high severity finding">
      <Badge variant="severity" severity="high">
        High
      </Badge>
      <div className="text-body text-fg-body">Auto-renewal clause requires 60-day notice.</div>
    </Card>
  ),
};
export const SeverityMedium: Story = {
  render: () => (
    <Card variant="severity-medium" className="p-3 space-y-1" aria-label="medium severity finding">
      <Badge variant="severity" severity="medium">
        Medium
      </Badge>
      <div className="text-body text-fg-body">Late-fee schedule above market.</div>
    </Card>
  ),
};
export const SeverityLow: Story = {
  render: () => (
    <Card variant="severity-low" className="p-3 space-y-1" aria-label="low severity finding">
      <Badge variant="severity" severity="low">
        Low
      </Badge>
      <div className="text-body text-fg-body">Pet deposit returned within 30 days of move-out.</div>
    </Card>
  ),
};
export const SeverityInfo: Story = {
  render: () => (
    <Card variant="severity-info" className="p-3 space-y-1" aria-label="informational finding">
      <Badge variant="severity" severity="info">
        Info
      </Badge>
      <div className="text-body text-fg-body">Quiet enjoyment clause is standard boilerplate.</div>
    </Card>
  ),
};
