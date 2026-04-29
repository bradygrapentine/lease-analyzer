import type { Meta, StoryObj } from '@storybook/react';
import { CounterOfferPanel } from './CounterOfferPanel';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { Finding } from '../rules/types';

function finding(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation: 'This lease auto-renews unless written notice is given.',
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

function co(over: Partial<CounterOffer>): CounterOffer {
  return {
    id: 'c1',
    ruleId: 'r-auto-renew',
    name: 'Strike auto-renewal',
    text: 'Section 4 is deleted in its entirety.',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const meta = {
  title: 'UI/CounterOfferPanel',
  component: CounterOfferPanel,
  args: {
    onSave: (ruleId: string, name: string, text: string) => {
      console.log('[stories] onSave', ruleId, name, text);
    },
    onDelete: (id: string) => {
      console.log('[stories] onDelete', id);
    },
  },
} satisfies Meta<typeof CounterOfferPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoFindingSelected: Story = {
  args: {
    finding: null,
    counters: [],
  },
};

export const EmptyForRule: Story = {
  args: {
    finding: finding(),
    counters: [co({ ruleId: 'other-rule', name: 'For a different rule' })],
  },
};

export const WithCounters: Story = {
  args: {
    finding: finding(),
    counters: [
      co({ id: 'c1', name: 'Strike auto-renewal' }),
      co({
        id: 'c2',
        name: 'Require 90-day written notice',
        text: 'Landlord must give Tenant written notice no less than ninety (90) days before expiration.',
      }),
    ],
  },
};

export const WithApplyHandler: Story = {
  args: {
    finding: finding(),
    counters: [co({ id: 'c1', name: 'Strike auto-renewal' })],
    onApply: (counter: CounterOffer) => {
      console.log('[stories] onApply', counter);
    },
  },
};
