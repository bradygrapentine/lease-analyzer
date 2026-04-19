import type { Meta, StoryObj } from '@storybook/react';
import { SideLetterPanel } from './SideLetterPanel';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'original',
    after: 'amended',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

const meta = {
  title: 'UI/SideLetterPanel',
  component: SideLetterPanel,
  args: {
    onSignerChange: (signer: { name: string; title: string }) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onSignerChange', signer);
    },
    onPreview: () => {
      // eslint-disable-next-line no-console
      console.log('[stories] onPreview');
    },
    onDownload: () => {
      // eslint-disable-next-line no-console
      console.log('[stories] onDownload');
    },
  },
} satisfies Meta<typeof SideLetterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoEdits: Story = {
  args: {
    leaseName: 'Acme Lease',
    edits: [],
  },
};

export const WithEdits: Story = {
  args: {
    leaseName: 'Acme Lease',
    edits: [
      mkEdit({ paragraphIndex: 2, after: 'Lease shall not automatically renew.' }),
      mkEdit({
        paragraphIndex: 7,
        after: 'Late fees capped at 5% of monthly rent.',
      }),
    ],
    signerDraft: { name: 'Jane Doe', title: 'General Counsel' },
  },
};
