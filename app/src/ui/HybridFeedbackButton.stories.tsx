import type { Meta, StoryObj } from '@storybook/react';
import { HybridFeedbackButton } from './HybridFeedbackButton';
import type { Finding } from '../rules/types';

const baseFinding: Finding = {
  ruleId: 'auto-renew',
  severity: 'medium',
  category: 'general',
  title: 'Auto-renewal clause',
  explanation: 'Clause renews automatically without notice.',
  citation: null,
  page: 2,
  paragraphIndex: 4,
  snippet: 'This Lease shall auto-renew for successive one-year terms…',
  span: { start: 0, end: 32 },
  confidence: 0.8,
  negated: false,
  rulePackVersion: '1.0.0',
  evidence: { modelId: 'all-MiniLM-L6-v2', similarity: 0.78 },
};

const meta = {
  title: 'UI/HybridFeedbackButton',
  component: HybridFeedbackButton,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HybridFeedbackButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    finding: baseFinding,
    leaseId: 'lease-storybook',
    onSubmit: () => {},
    listEntries: () => Promise.resolve([]),
  },
};

export const AlreadySubmitted: Story = {
  args: {
    finding: baseFinding,
    leaseId: 'lease-storybook',
    onSubmit: () => {},
    listEntries: () =>
      Promise.resolve([
        {
          kind: 'hybrid-feedback',
          payload: {
            ruleId: baseFinding.ruleId,
            paragraphIndex: baseFinding.paragraphIndex,
            leaseId: 'lease-storybook',
            signal: 'not-relevant',
            modelId: 'all-MiniLM-L6-v2',
            similarity: 0.78,
          },
        },
      ]),
  },
};
