import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingTour } from './OnboardingTour';

const meta = {
  title: 'UI/OnboardingTour',
  component: OnboardingTour,
  args: {
    onDismiss: () => {
      console.log('[stories] onboarding dismissed');
    },
  },
} satisfies Meta<typeof OnboardingTour>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Step-N stories click "Next" the right number of times after mount so the
 * panel renders the requested step without exposing internal state.
 */
function AutoAdvance({
  steps,
  viewMode,
}: {
  steps: number;
  viewMode?: 'current' | 'portfolio' | 'redline';
}): JSX.Element {
  useEffect(() => {
    for (let i = 0; i < steps; i += 1) {
      const next = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.onboarding-tour button'),
      ).find((b) => b.textContent?.trim() === 'Next');
      next?.click();
    }
  }, [steps]);
  return <OnboardingTour dismissedAt={null} onDismiss={() => {}} viewMode={viewMode} />;
}

export const Step1Upload: Story = {
  args: { dismissedAt: null },
};

export const Step2Findings: Story = {
  args: { dismissedAt: null },
  render: () => <AutoAdvance steps={1} />,
};

export const Step3PortfolioFromCurrent: Story = {
  args: { dismissedAt: null, viewMode: 'current' },
  render: () => <AutoAdvance steps={2} viewMode="current" />,
};

export const Step3PortfolioFromPortfolio: Story = {
  args: { dismissedAt: null, viewMode: 'portfolio' },
  render: () => <AutoAdvance steps={2} viewMode="portfolio" />,
};

export const Step4AuditAndExport: Story = {
  args: { dismissedAt: null },
  render: () => <AutoAdvance steps={3} />,
};

export const AlreadyDismissed: Story = {
  args: {
    dismissedAt: 1_700_000_000_000,
  },
};
