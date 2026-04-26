import type { Meta, StoryObj } from '@storybook/react';
import { Section } from './Section';

const meta: Meta<typeof Section> = {
  title: 'System/Section',
  component: Section,
};
export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: { label: 'Findings', children: 'Section body content' },
};
export const Collapsible: Story = {
  args: { label: 'Details', collapsible: true, children: 'Collapsible section body' },
};
export const CollapsedByDefault: Story = {
  args: {
    label: 'Annotations',
    collapsible: true,
    defaultExpanded: false,
    children: 'Hidden by default',
  },
};
