import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'System/Card',
  component: Card,
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = { args: { children: 'Default card content' } };
export const WithLabel: Story = {
  args: { 'aria-label': 'selected finding', children: 'Card rendered as article' },
};
export const AccentHigh: Story = { args: { accent: 'high', children: 'High severity accent' } };
export const AccentMedium: Story = {
  args: { accent: 'medium', children: 'Medium severity accent' },
};
export const AccentLow: Story = { args: { accent: 'low', children: 'Low severity accent' } };
export const AccentInfo: Story = { args: { accent: 'info', children: 'Info severity accent' } };
