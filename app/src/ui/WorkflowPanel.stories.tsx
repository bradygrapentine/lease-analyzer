import type { Meta, StoryObj } from '@storybook/react';
import { WorkflowPanel } from './WorkflowPanel';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation: 'Lease auto-renews unless written notice is given.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'This lease shall automatically renew…',
    span: { start: 0, end: 40 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: 'v1',
    ...over,
  };
}

const meta = {
  title: 'UI/WorkflowPanel',
  component: WorkflowPanel,
  args: {
    leaseName: 'Unit 4B lease.pdf',
    onBuildIcs: () => {
      // eslint-disable-next-line no-alert
      alert('buildIcs');
    },
    onCopySummary: async () => {
      // eslint-disable-next-line no-alert
      alert('copySummary');
    },
    onDownloadHandoff: () => {
      // eslint-disable-next-line no-alert
      alert('downloadHandoff');
    },
  },
} satisfies Meta<typeof WorkflowPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    findings: [],
  },
};

export const WithFindings: Story = {
  args: {
    findings: [
      f(),
      f({ severity: 'medium', title: 'Late fees stack', page: 2 }),
      f({ severity: 'low', title: 'Non-refundable pet fee', page: 3 }),
    ],
  },
};

export const CopyFailure: Story = {
  args: {
    findings: [f()],
    onCopySummary: async () => {
      throw new Error('clipboard denied');
    },
  },
};
