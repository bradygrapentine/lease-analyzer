import type { Meta, StoryObj } from '@storybook/react';
import { JurisdictionPickerPanel } from './JurisdictionPickerPanel';

const ALL = ['US-CA', 'US-NY', 'US-TX', 'US-FL', 'UK-ENG', 'CA-ON'];

const meta = {
  title: 'UI/JurisdictionPickerPanel',
  component: JurisdictionPickerPanel,
  args: {
    onChange: () => {},
  },
} satisfies Meta<typeof JurisdictionPickerPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    available: [],
    selected: [],
  },
};

export const NoneSelected: Story = {
  args: {
    available: ALL,
    selected: [],
  },
};

export const OneSelected: Story = {
  args: {
    available: ALL,
    selected: ['US-CA'],
  },
};

export const MultipleSelected: Story = {
  args: {
    available: ALL,
    selected: ['US-CA', 'UK-ENG', 'CA-ON'],
  },
};
