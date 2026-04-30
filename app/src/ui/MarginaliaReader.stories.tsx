import type { Meta, StoryObj } from '@storybook/react';
import { MarginaliaReader } from './MarginaliaReader';
import { I18nProvider } from '../i18n/I18nProvider';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

const sampleDoc: LeaseDocument = {
  pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
  paragraphs: [
    {
      text: 'This Lease Agreement is made between Landlord and Tenant for the property described herein.',
      page: 1,
    },
    {
      text: 'The lease shall auto-renew for additional one-year terms unless either party gives written notice at least sixty (60) days prior to the expiration of the current term.',
      page: 1,
    },
    {
      text: 'Tenant agrees to pay rent on the first day of each month. Late payment incurs a $50 fee.',
      page: 1,
    },
    {
      text: 'Tenant waives the right to a jury trial in any action arising under this Lease.',
      page: 1,
    },
  ],
  sections: [],
  raw: '',
};

const sampleFindings: Finding[] = [
  {
    ruleId: 'auto-renew',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal: lease renews unless notice is given.',
    explanation: '',
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
    explanation: '',
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
  title: 'AppCurrentPane/MarginaliaReader',
  component: MarginaliaReader,
  decorators: [
    (Story): JSX.Element => (
      <I18nProvider>
        <div className="flex h-[640px] bg-paper">
          <Story />
        </div>
      </I18nProvider>
    ),
  ],
} satisfies Meta<typeof MarginaliaReader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    doc: sampleDoc,
    findings: sampleFindings,
    selected: null,
    onSelectFinding: () => {},
    fileName: 'sample-lease.pdf',
  },
};

export const ActiveSelection: Story = {
  args: {
    doc: sampleDoc,
    findings: sampleFindings,
    selected: sampleFindings[1] ?? null,
    onSelectFinding: () => {},
    fileName: 'sample-lease.pdf',
  },
};
