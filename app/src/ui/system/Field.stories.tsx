import type { Meta, StoryObj } from '@storybook/react';
import { Field } from './Field';

const meta: Meta<typeof Field> = {
  title: 'System/Field',
  component: Field,
};
export default meta;
type Story = StoryObj<typeof Field>;

export const Input: Story = { args: { label: 'Name', placeholder: 'Enter name...' } };
export const Textarea: Story = {
  args: { label: 'Note', as: 'textarea', placeholder: 'Write your note...' },
};
export const Select: Story = {
  args: {
    label: 'Language',
    as: 'select',
    children: (
      <>
        <option value="en">English</option>
        <option value="es">Spanish</option>
      </>
    ),
  },
};
export const WithDescription: Story = {
  args: {
    label: 'Email',
    description: 'Enter your work email address',
    placeholder: 'you@example.com',
  },
};
