import type { Meta, StoryObj } from '@storybook/react';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import type { LeaseVersion } from '../negotiation/versionHistory';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'b',
    after: 'a',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

function mkVersion(over: Partial<LeaseVersion> = {}): LeaseVersion {
  return {
    versionId: 'v1',
    leaseId: 'L1',
    createdAt: '2026-04-18T12:00:00.000Z',
    edits: [mkEdit()],
    ...over,
  };
}

const meta = {
  title: 'UI/VersionHistoryPanel',
  component: VersionHistoryPanel,
  args: {
    onCreateVersion: (label?: string, note?: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onCreateVersion', label, note);
    },
    onRestoreVersion: (versionId: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onRestoreVersion', versionId);
    },
    onDeleteVersion: (versionId: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onDeleteVersion', versionId);
    },
    onExportVersion: (versionId: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] onExportVersion', versionId);
    },
  },
} satisfies Meta<typeof VersionHistoryPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    versions: [],
    currentEditCount: 0,
  },
};

export const WithUnsavedEdits: Story = {
  args: {
    versions: [],
    currentEditCount: 4,
  },
};

export const WithTimeline: Story = {
  args: {
    versions: [
      mkVersion({
        versionId: 'v3',
        createdAt: '2026-04-18T14:00:00.000Z',
        label: 'Post-call markup',
        note: 'Opened late-fee discussion on call with landlord.',
        edits: [mkEdit(), mkEdit({ paragraphIndex: 1 }), mkEdit({ paragraphIndex: 2 })],
      }),
      mkVersion({
        versionId: 'v2',
        createdAt: '2026-04-17T14:00:00.000Z',
        label: 'Second pass',
        edits: [mkEdit(), mkEdit({ paragraphIndex: 1 })],
      }),
      mkVersion({
        versionId: 'v1',
        createdAt: '2026-04-16T14:00:00.000Z',
        label: 'First pass',
      }),
    ],
    currentEditCount: 1,
  },
};
