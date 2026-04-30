import type { Meta, StoryObj } from '@storybook/react';
import { LoadingView } from './LoadingView';

const meta: Meta<typeof LoadingView> = {
  title: 'App / LoadingView',
  component: LoadingView,
};
export default meta;

type Story = StoryObj<typeof LoadingView>;

export const Default: Story = { args: { fileName: '1428 Cortland Ave — Residential Lease.pdf' } };

export const Static: Story = {
  args: { fileName: 'snapshot.pdf', intervalMs: 0 },
};
