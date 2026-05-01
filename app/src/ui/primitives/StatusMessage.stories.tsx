import type { Meta, StoryObj } from '@storybook/react';
import { StatusMessage } from './StatusMessage';

const meta: Meta<typeof StatusMessage> = {
  title: 'Primitives/StatusMessage',
  component: StatusMessage,
};
export default meta;
type Story = StoryObj<typeof StatusMessage>;

export const Success: Story = {
  args: { tone: 'success', children: 'Saved. The pack is now active.' },
};

export const ErrorTone: Story = {
  name: 'Error',
  args: {
    tone: 'error',
    children: 'Verification failed: signature did not match.',
  },
};

export const Info: Story = {
  args: {
    tone: 'info',
    children: 'No signing key yet — generate one to enable signed exports.',
  },
};

export const Warn: Story = {
  args: {
    tone: 'warn',
    children: 'This pack is unsigned. Findings will be flagged accordingly.',
  },
};
