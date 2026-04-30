import type { Meta, StoryObj } from '@storybook/react';
import { FindingRail } from './FindingRail';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'r1',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: '',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start: 0, end: 1 },
    confidence: 1,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

const meta = {
  title: 'AppCurrentPane/FindingRail',
  component: FindingRail,
  decorators: [
    (Story): JSX.Element => (
      <I18nProvider>
        <div className="flex h-96 bg-paper">
          <Story />
        </div>
      </I18nProvider>
    ),
  ],
} satisfies Meta<typeof FindingRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  args: {
    paragraphCount: 30,
    findings: [
      f({ paragraphIndex: 2, severity: 'high' }),
      f({ paragraphIndex: 7, severity: 'medium' }),
      f({ paragraphIndex: 11, severity: 'low' }),
      f({ paragraphIndex: 22, severity: 'info' }),
      f({ paragraphIndex: 27, severity: 'high' }),
    ],
    selected: null,
    onSelectFinding: () => {},
  },
};

export const ActiveSelection: Story = {
  args: {
    paragraphCount: 30,
    findings: [
      f({ paragraphIndex: 2, severity: 'high' }),
      f({ paragraphIndex: 7, severity: 'medium' }),
    ],
    selected: f({ paragraphIndex: 7, severity: 'medium' }),
    onSelectFinding: () => {},
  },
};
