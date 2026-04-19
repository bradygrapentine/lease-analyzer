import type { Meta, StoryObj } from '@storybook/react';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation:
      'This lease auto-renews unless written notice is given at least 60 days before the end of the term.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'This lease shall automatically renew for successive one-year terms…',
    span: { start: 0, end: 40 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: 'v1',
    ...overrides,
  };
}

const mixed: Finding[] = [
  makeFinding({
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
  }),
  makeFinding({
    ruleId: 'r-late-fee',
    severity: 'medium',
    category: 'fees',
    title: 'Late fee stacking',
    explanation: 'Late fees compound monthly, which may exceed statutory caps in some states.',
    snippet: 'A late fee of 10% of monthly rent shall accrue each month unpaid…',
    page: 2,
    paragraphIndex: 7,
  }),
  makeFinding({
    ruleId: 'r-arbitration',
    severity: 'medium',
    category: 'dispute',
    title: 'Mandatory arbitration (not applicable)',
    explanation: 'Arbitration language appears but is negated by a carve-out clause.',
    snippet: 'Nothing in this Lease shall require arbitration of consumer disputes…',
    page: 4,
    paragraphIndex: 11,
    negated: true,
    confidence: 0.45,
  }),
  makeFinding({
    ruleId: 'r-pet-fee',
    severity: 'low',
    category: 'fees',
    title: 'Non-refundable pet fee',
    explanation: 'Pet fee is explicitly non-refundable.',
    snippet: 'Tenant shall pay a non-refundable pet fee of $500…',
    page: 3,
    paragraphIndex: 9,
  }),
  makeFinding({
    ruleId: 'r-notice',
    severity: 'info',
    category: 'general',
    title: 'Standard notice provision',
    explanation: 'Notice period is 30 days, which matches typical statutes.',
    snippet: 'Either party may terminate with 30 days written notice…',
    page: 5,
    paragraphIndex: 15,
  }),
];

const meta = {
  title: 'UI/FindingsPanel',
  component: FindingsPanel,
  args: {
    onSelect: () => {},
  },
} satisfies Meta<typeof FindingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    findings: [],
  },
};

export const MixedSeverities: Story = {
  args: {
    findings: mixed,
  },
};

export const WithPlainEnglishAndGlossary: Story = {
  args: {
    findings: mixed,
    plainEnglishByRuleId: {
      'r-auto-renew':
        'If you do nothing, the lease keeps going. Put the notice deadline on your calendar.',
      'r-late-fee':
        'Missed rent adds an extra fee. Compounding monthly can make the total grow quickly.',
      'r-arbitration':
        'A private decision-maker hears the dispute instead of a court, and the decision usually cannot be appealed.',
    },
    definitions: [
      { term: 'Lease', definition: 'this rental agreement.', page: 1, paragraphIndex: 0 },
      { term: 'Premises', definition: 'the leased space.', page: 1, paragraphIndex: 1 },
      { term: 'Tenant', definition: 'the party renting the premises.', page: 1, paragraphIndex: 2 },
    ],
  },
};
