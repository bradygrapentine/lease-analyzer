import type { Meta, StoryObj } from '@storybook/react';
import { DeltaPanel } from './DeltaPanel';

const meta: Meta<typeof DeltaPanel> = {
  title: 'Wave9/DeltaPanel',
  component: DeltaPanel,
};

export default meta;
type Story = StoryObj<typeof DeltaPanel>;

export const Empty: Story = {
  args: {
    versions: [],
    onGenerate: async (): Promise<Uint8Array> => new Uint8Array(),
  },
};

export const TwoVersions: Story = {
  args: {
    versions: [
      { id: 'v1', label: 'v1 — initial draft' },
      { id: 'v2', label: 'v2 — landlord redline' },
    ],
    onGenerate: async (): Promise<Uint8Array> => new Uint8Array([1, 2, 3]),
  },
};
