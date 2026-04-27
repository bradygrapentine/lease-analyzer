import type { Meta, StoryObj } from '@storybook/react';
import { ThemeToggle } from './ThemeToggle';

const meta = {
  title: 'UI/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story, ctx) => {
      const theme = (ctx.parameters as { theme?: 'light' | 'dark' }).theme ?? 'light';
      return (
        <div data-theme={theme} style={{ padding: 24, background: 'var(--color-paper)' }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SystemDefault: Story = { parameters: { theme: 'light' } };
export const Light: Story = { parameters: { theme: 'light' } };
export const Dark: Story = { parameters: { theme: 'dark' } };
