import type { Meta, StoryObj } from '@storybook/react';
import { OfflineDot } from './OfflineDot';

const meta: Meta<typeof OfflineDot> = {
  title: 'App / OfflineDot',
  component: OfflineDot,
};
export default meta;

type Story = StoryObj<typeof OfflineDot>;

export const Default: Story = {};
