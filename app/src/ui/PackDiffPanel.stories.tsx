import type { Meta, StoryObj } from '@storybook/react';
import { PackDiffPanel } from './PackDiffPanel';
import type { PackDiff } from '../rules/packDiff';
import type { Rule } from '../rules/types';

function rule(o: Partial<Rule> & { id: string; title: string }): Rule {
  return {
    id: o.id,
    severity: o.severity ?? 'medium',
    category: o.category ?? 'fees',
    title: o.title,
    explanation: o.explanation ?? '(summary)',
    citation: o.citation ?? null,
    match: o.match ?? { type: 'regex', pattern: 'x', flags: 'i' },
  };
}

const addedOnly: PackDiff = {
  added: [
    rule({ id: 'ca-deposit-cap', title: 'Security deposit cap (CA)', severity: 'medium', category: 'finance' }),
    rule({ id: 'ca-entry-notice', title: 'Landlord 24-hour notice', severity: 'low', category: 'obligations' }),
  ],
  removed: [],
  changed: [],
};

const removedOnly: PackDiff = {
  added: [],
  removed: [
    rule({ id: 'old-waiver', title: 'Generic right-of-waiver clause', severity: 'low', category: 'general' }),
  ],
  changed: [],
};

const changedOnly: PackDiff = {
  added: [],
  removed: [],
  changed: [
    {
      ruleId: 'auto-renew',
      fields: ['severity', 'title'],
      before: rule({ id: 'auto-renew', title: 'Auto-renewal', severity: 'low' }),
      after: rule({ id: 'auto-renew', title: 'Auto-renewal clause', severity: 'high' }),
    },
    {
      ruleId: 'holdover',
      fields: ['explanation', 'match'],
      before: rule({
        id: 'holdover',
        title: 'Holdover penalty',
        explanation: 'Charges double rent during holdover.',
        match: { type: 'regex', pattern: 'holdover', flags: 'i' },
      }),
      after: rule({
        id: 'holdover',
        title: 'Holdover penalty',
        explanation: 'Charges up to 200% of rent during holdover.',
        match: { type: 'keywordProximity', keywords: ['holdover', 'rent'], window: 40 },
      }),
    },
  ],
};

const combined: PackDiff = {
  added: addedOnly.added,
  removed: removedOnly.removed,
  changed: changedOnly.changed,
};

const empty: PackDiff = { added: [], removed: [], changed: [] };

const meta = {
  title: 'UI/PackDiffPanel',
  component: PackDiffPanel,
} satisfies Meta<typeof PackDiffPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { diff: empty } };
export const AddedOnly: Story = { args: { diff: addedOnly } };
export const RemovedOnly: Story = { args: { diff: removedOnly } };
export const ChangedOnly: Story = { args: { diff: changedOnly } };
export const Combined: Story = { args: { diff: combined } };
