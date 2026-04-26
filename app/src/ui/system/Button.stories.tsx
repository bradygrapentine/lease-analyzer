import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'System/Button',
  component: Button,
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Default' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };
export const Subtle: Story = { args: { variant: 'subtle', children: 'Subtle' } };
export const Small: Story = { args: { size: 'sm', children: 'Small' } };
export const Pressed: Story = { args: { pressed: true, children: 'Pressed' } };
