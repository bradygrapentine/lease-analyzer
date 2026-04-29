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
      console.log('[stories] onSignerChange', signer);
    },
    onPreview: () => {
      console.log('[stories] onPreview');
    },
    onDownload: () => {
      console.log('[stories] onDownload');
    },
    onDownloadPdf: () => {
      console.log('[stories] onDownloadPdf');
    },
    onClosePreview: () => {
      console.log('[stories] onClosePreview');
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

export const WithInPanelPreview: Story = {
  args: {
    leaseName: 'Acme Lease',
    edits: [mkEdit({ paragraphIndex: 2, after: 'Lease shall not automatically renew.' })],
    signerDraft: { name: 'Jane Doe', title: 'General Counsel' },
    previewHtml: `<!doctype html><html><body style="font-family: system-ui; padding: 1rem">
<h1>Side Letter</h1><p>Re: Acme Lease</p>
<ol><li><strong>1. Page N, ¶ 3.</strong> The parties agree that the text of Page N, ¶ 3 is amended to read: "Lease shall not automatically renew.".</li></ol>
<p>Sincerely,<br><strong>Jane Doe</strong><br>General Counsel</p>
</body></html>`,
  },
};
