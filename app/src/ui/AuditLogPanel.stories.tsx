import type { Meta, StoryObj } from '@storybook/react';
import type { AuditEntry } from '../audit/auditLog';
import { AuditLogPanel } from './AuditLogPanel';

const entries: AuditEntry[] = [
  {
    seq: 1,
    timestamp: '2026-04-18T09:00:00.000Z',
    kind: 'analyze',
    payload: { leaseName: 'alpha.pdf', findings: 7 },
    prevHash: '',
    entryHash: 'a'.repeat(64),
  },
  {
    seq: 2,
    timestamp: '2026-04-18T09:05:00.000Z',
    kind: 'export',
    payload: { format: 'json', signed: true },
    prevHash: 'a'.repeat(64),
    entryHash: 'b'.repeat(64),
  },
  {
    seq: 3,
    timestamp: '2026-04-18T09:07:00.000Z',
    kind: 'import-pack',
    payload: { packId: 'ca-tenant-starter', version: '0.1.0' },
    prevHash: 'b'.repeat(64),
    entryHash: 'c'.repeat(64),
  },
];

const meta = {
  title: 'UI/AuditLogPanel',
  component: AuditLogPanel,
  args: {
    onRefresh: () => {},
    onDownload: () => {},
    onVerify: () => {},
  },
} satisfies Meta<typeof AuditLogPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    entries: [],
    verification: null,
  },
};

export const WithEntriesUnverified: Story = {
  args: {
    entries,
    verification: null,
  },
};

export const ChainIntact: Story = {
  args: {
    entries,
    verification: { ok: true },
  },
};

export const ChainBroken: Story = {
  args: {
    entries,
    verification: { ok: false, firstBadSeq: 2 },
  },
};
