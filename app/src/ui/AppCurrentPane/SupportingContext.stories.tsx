import type { Meta, StoryObj } from '@storybook/react';
import { SupportingContext } from './SupportingContext';
import type { LeaseDocument } from '../../parser/types';
import type { LeaseFacts } from '../../facts/types';
import type { Finding } from '../../rules/types';
import type { UseAnnotationsApi } from '../../App/useAnnotations';
import type { UseCounterOffersApi } from '../../App/useCounterOffers';

const doc: LeaseDocument = {
  pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
  paragraphs: [{ text: 'Tenant shall pay rent.', page: 1 }],
  sections: [],
  raw: 'Tenant shall pay rent.',
};

const facts: LeaseFacts = {
  baseRent: null,
  securityDeposit: null,
  termMonths: null,
  noticePeriodDays: null,
  commencementDate: null,
  expirationDate: null,
  definitions: [],
  crossReferences: [],
};

const annotations: UseAnnotationsApi = {
  annotations: [],
  save: async () => undefined,
  update: async () => undefined,
  remove: async () => undefined,
};

const counters: UseCounterOffersApi = {
  counterOffers: [],
  save: async () => undefined,
  remove: async () => undefined,
  refresh: async () => undefined,
};

const meta = {
  title: 'UI/AppCurrentPane/SupportingContext',
  component: SupportingContext,
  args: {
    status: { fileName: 'lease.pdf', bytes: null, result: { doc, findings: [] as Finding[] } },
    selected: null,
    analyzedLeaseId: 'L1',
    annotationsApi: annotations,
    counters: counters,
    templates: [],
    leaseFacts: facts,
    suggestedEditByRuleId: {},
    onBuildIcs: () => {},
  },
} satisfies Meta<typeof SupportingContext>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
