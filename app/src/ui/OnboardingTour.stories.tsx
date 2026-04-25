import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingTour } from './OnboardingTour';

const meta = {
  title: 'UI/OnboardingTour',
  component: OnboardingTour,
  args: {
    onDismiss: () => {
      // eslint-disable-next-line no-console
      console.log('[stories] onboarding dismissed');
    },
  },
} satisfies Meta<typeof OnboardingTour>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstRun: Story = {
  args: {
    dismissedAt: null,
  },
};

export const AlreadyDismissed: Story = {
  args: {
    dismissedAt: 1_700_000_000_000,
  },
};
