import type { Meta, StoryObj } from '@storybook/react';
import { AnnotationsPanel } from './AnnotationsPanel';
import type { Annotation } from '../annotations/annotations';

function ann(over: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    leaseId: 'L1',
    paragraphIndex: 3,
    text: 'Ask about renewal',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const meta = {
  title: 'UI/AnnotationsPanel',
  component: AnnotationsPanel,
  args: {
    leaseId: 'L1',
    onSave: (text: string) => {
      console.log('[stories] onSave', text);
    },
    onUpdate: (id: string, text: string) => {
      console.log('[stories] onUpdate', id, text);
    },
    onDelete: (id: string) => {
      console.log('[stories] onDelete', id);
    },
  },
} satisfies Meta<typeof AnnotationsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoFindingSelected: Story = {
  args: {
    paragraphIndex: null,
    annotations: [],
  },
};

export const EmptyForParagraph: Story = {
  args: {
    paragraphIndex: 3,
    annotations: [ann({ paragraphIndex: 99, text: 'Other paragraph note' })],
  },
};

export const WithNotes: Story = {
  args: {
    paragraphIndex: 3,
    annotations: [
      ann({ id: 'n1', paragraphIndex: 3, text: 'Ask landlord to strike auto-renewal.' }),
      ann({
        id: 'n2',
        paragraphIndex: 3,
        text: 'Follow up about 60-day vs 90-day notice window.',
      }),
    ],
  },
};
