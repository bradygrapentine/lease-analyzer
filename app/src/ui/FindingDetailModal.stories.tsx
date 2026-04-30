import type { Meta, StoryObj } from '@storybook/react';
import { FindingDetailModal } from './FindingDetailModal';
import { I18nProvider } from '../i18n/I18nProvider';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

const doc: LeaseDocument = {
  pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
  paragraphs: [
    { text: 'Lease intro.', page: 1 },
    {
      text: 'The lease shall auto-renew for additional one-year terms unless either party gives written notice at least sixty (60) days prior to the expiration of the current term.',
      page: 1,
    },
    { text: 'Tenant agrees to pay rent on the first day of each month.', page: 1 },
    { text: 'Tenant waives the right to a jury trial in any action.', page: 1 },
  ],
  sections: [],
  raw: '',
};

const findings: Finding[] = [
  {
    ruleId: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal: lease renews unless notice is given.',
    explanation:
      'The lease silently renews unless you affirmatively cancel — a deadline you must remember.',
    citation: null,
    page: 1,
    paragraphIndex: 1,
    snippet: 'auto-renew for additional one-year terms',
    span: { start: 16, end: 56 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
  },
  {
    ruleId: 'jury-waiver',
    severity: 'high',
    category: 'liability',
    title: 'Jury trial waiver — surrender of constitutional jury rights.',
    explanation: 'Disputes go to a judge alone, not a jury — a common pro-landlord shift.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'waives the right to a jury trial',
    span: { start: 7, end: 39 },
    confidence: 1,
    negated: false,
    rulePackVersion: '1.0.0',
  },
];

const meta = {
  title: 'AppCurrentPane/FindingDetailModal',
  component: FindingDetailModal,
  decorators: [
    (Story): JSX.Element => (
      <I18nProvider>
        <div className="bg-paper-sunken min-h-[640px]">
          <Story />
        </div>
      </I18nProvider>
    ),
  ],
} satisfies Meta<typeof FindingDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    doc,
    finding: findings[0] ?? null,
    allFindings: findings,
    onSelect: () => {},
    onClose: () => {},
    suggestedTextByRuleId: {
      'auto-renewal': 'Either party may terminate with thirty (30) days written notice.',
    },
    plainEnglishByRuleId: {},
  },
};

export const HighSeverity: Story = {
  args: {
    open: true,
    doc,
    finding: findings[1] ?? null,
    allFindings: findings,
    onSelect: () => {},
    onClose: () => {},
    suggestedTextByRuleId: {},
    plainEnglishByRuleId: {},
  },
};
