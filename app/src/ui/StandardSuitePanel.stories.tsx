import type { Meta, StoryObj } from '@storybook/react';
import { StandardSuitePanel } from './StandardSuitePanel';
import type { StandardClause } from '../clauseStandard/standardSuite';

const SUITE: StandardClause[] = [
  {
    id: 's1',
    name: 'Auto-renewal standard',
    sourceLeaseId: 'L1',
    sourceParagraphIndex: 2,
    normalizedText: 'auto renewal text',
    createdAt: 1,
  },
  {
    id: 's2',
    name: 'Indemnification standard',
    sourceLeaseId: 'L2',
    sourceParagraphIndex: 5,
    normalizedText: 'indemnification text',
    createdAt: 2,
  },
];

const meta = {
  title: 'UI/StandardSuitePanel',
  component: StandardSuitePanel,
  args: {
    onDelete: (id: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onDelete', id);
    },
  },
} satisfies Meta<typeof StandardSuitePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { standards: [] } };
export const Populated: Story = { args: { standards: SUITE } };
