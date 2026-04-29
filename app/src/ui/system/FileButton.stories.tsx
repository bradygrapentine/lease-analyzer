import type { Meta, StoryObj } from '@storybook/react';
import { FileButton } from './FileButton';

const meta: Meta<typeof FileButton> = {
  title: 'System/FileButton',
  component: FileButton,
  args: {
    onFiles: () => {},
    children: 'Import lease',
    'aria-label': 'Import lease',
  },
};
export default meta;
type Story = StoryObj<typeof FileButton>;

export const DefaultMd: Story = { args: { variant: 'subtle', size: 'md' } };
export const Sm: Story = { args: { variant: 'subtle', size: 'sm' } };
export const Ghost: Story = { args: { variant: 'ghost', size: 'sm', children: 'Pick file' } };
export const Multiple: Story = {
  args: { multiple: true, accept: '.pdf', children: 'Import multiple' },
};
export const Disabled: Story = { args: { disabled: true, children: 'Import (disabled)' } };
