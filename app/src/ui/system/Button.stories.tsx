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
// Wave 29-E size variants. `md` is the new default with a 44×44
// minimum tap target (WCAG 2.5.5 AAA / 2.5.8 AA). `sm` (32×32) is the
// dense-toolbar opt-in.
export const SizeSmall: Story = { args: { size: 'sm', children: 'Small (32px)' } };
export const SizeMedium: Story = { args: { size: 'md', children: 'Medium (44px)' } };
export const Pressed: Story = { args: { pressed: true, children: 'Pressed' } };
