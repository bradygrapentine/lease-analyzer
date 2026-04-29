import type { Meta, StoryObj } from '@storybook/react';
import { RedlinePanel } from './RedlinePanel';
import type { LeaseDocument } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';

function docOf(...texts: string[]): LeaseDocument {
  return {
    pages: [],
    paragraphs: texts.map((t) => ({ text: t, page: 1 })),
    sections: [],
    raw: texts.join('\n'),
  };
}

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'original',
    after: 'edited',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

const meta = {
  title: 'UI/RedlinePanel',
  component: RedlinePanel,
  args: {
    onEditParagraph: (paragraphIndex: number, after: string) => {
      console.log('[stories] onEditParagraph', paragraphIndex, after);
    },
    onDeleteEdit: (paragraphIndex: number) => {
      console.log('[stories] onDeleteEdit', paragraphIndex);
    },
    onExportHtml: () => {
      console.log('[stories] onExportHtml');
    },
  },
} satisfies Meta<typeof RedlinePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoDoc: Story = {
  args: {
    doc: null,
    edits: [],
  },
};

export const UneditedDoc: Story = {
  args: {
    doc: docOf(
      'This lease shall automatically renew at the end of the initial term.',
      'Late fees are 10% of the monthly rent per day.',
      'All disputes shall be resolved by binding arbitration.',
    ),
    edits: [],
  },
};

export const WithEdits: Story = {
  args: {
    doc: docOf(
      'This lease shall automatically renew at the end of the initial term.',
      'Late fees are 10% of the monthly rent per day.',
      'All disputes shall be resolved by binding arbitration.',
    ),
    edits: [
      mkEdit({
        paragraphIndex: 0,
        before: 'This lease shall automatically renew at the end of the initial term.',
        after:
          'This lease shall not automatically renew; either party may terminate on 30 days written notice.',
      }),
      mkEdit({
        paragraphIndex: 2,
        before: 'All disputes shall be resolved by binding arbitration.',
        after:
          'Disputes shall first be mediated in good faith; only failing mediation will binding arbitration apply.',
      }),
    ],
  },
};
