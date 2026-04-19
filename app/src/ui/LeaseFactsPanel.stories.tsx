import type { Meta, StoryObj } from '@storybook/react';
import { LeaseFactsPanel } from './LeaseFactsPanel';
import type { LeaseFacts } from '../facts/types';

const populated: LeaseFacts = {
  baseRent: { amount: 2500, currency: 'USD', raw: '$2,500', page: 1 },
  securityDeposit: { amount: 2000, currency: 'USD', raw: '$2,000', page: 1 },
  termMonths: 12,
  noticePeriodDays: 30,
  commencementDate: '2026-01-01',
  expirationDate: '2026-12-31',
  definitions: [
    {
      term: 'Premises',
      definition: 'the real property located at 123 Main St',
      page: 1,
      paragraphIndex: 1,
    },
    {
      term: 'Base Rent',
      definition: 'the monthly rent specified in Section 2',
      page: 2,
      paragraphIndex: 4,
    },
  ],
  crossReferences: [
    { text: 'Section 4.2', target: 'section:Section 4.2', page: 1, paragraphIndex: 3 },
    { text: 'Exhibit A', target: 'exhibit:Exhibit A', page: 2, paragraphIndex: 5 },
    { text: 'Schedule 1', target: 'schedule:Schedule 1', page: 2, paragraphIndex: 5 },
  ],
  rentSchedule: [
    { from: '2026-01-01', to: '2026-12-31', amount: 1000, escalator: 3 },
    { from: '2027-01-01', to: '2027-12-31', amount: 1030, escalator: 3 },
    { from: '2028-01-01', to: '2028-12-31', amount: 1060.9, escalator: 3 },
  ],
};

const empty: LeaseFacts = {
  baseRent: null,
  securityDeposit: null,
  termMonths: null,
  noticePeriodDays: null,
  commencementDate: null,
  expirationDate: null,
  definitions: [],
  crossReferences: [],
};

const meta = {
  title: 'UI/LeaseFactsPanel',
  component: LeaseFactsPanel,
} satisfies Meta<typeof LeaseFactsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { facts: populated },
};

export const Empty: Story = {
  args: { facts: empty },
};
