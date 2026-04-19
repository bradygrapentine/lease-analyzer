import type { Meta, StoryObj } from '@storybook/react';
import { CustomRuleBuilderPanel } from './CustomRuleBuilderPanel';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph } from '../parser/types';

function docFrom(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: detectSections(paragraphs),
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

const RENEW_DOC = docFrom([
  { text: 'This lease shall automatically renew for one year.', page: 1 },
  { text: 'Absent timely notice the term will automatically renew.', page: 1 },
]);

const BENIGN_DOC = docFrom([
  { text: 'Tenant shall pay rent on the first of each month.', page: 1 },
]);

const meta = {
  title: 'UI/CustomRuleBuilderPanel',
  component: CustomRuleBuilderPanel,
  args: {
    onSave: () => {},
  },
} satisfies Meta<typeof CustomRuleBuilderPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    doc: null,
    existingRuleIds: [],
  },
};

export const EditingNoDoc: Story = {
  args: {
    doc: null,
    existingRuleIds: ['auto-renewal'],
  },
};

export const PreviewHit: Story = {
  args: {
    doc: RENEW_DOC,
    existingRuleIds: [],
  },
};

export const PreviewMiss: Story = {
  args: {
    doc: BENIGN_DOC,
    existingRuleIds: [],
  },
};

export const InvalidRegex: Story = {
  args: {
    doc: RENEW_DOC,
    existingRuleIds: [],
  },
};
