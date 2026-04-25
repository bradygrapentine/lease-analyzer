import type { Meta, StoryObj } from '@storybook/react';
import { MarketplacePanel } from './MarketplacePanel';
import type { CuratedPackEntry } from '../rules/curatedPacks';

const ENTRIES: CuratedPackEntry[] = [
  {
    id: 'us-ca-residential',
    name: 'California residential',
    description: 'Curated residential rules for California.',
    jurisdictions: ['US-CA'],
    author: 'LeaseGuard core',
    fingerprint: 'a'.repeat(64),
    path: '/packs/curated/us-ca-residential.lgpack.json',
  },
  {
    id: 'us-ny-commercial',
    name: 'New York commercial',
    description: 'Curated NY commercial rules.',
    jurisdictions: ['US-NY'],
    author: 'LeaseGuard core',
    fingerprint: 'b'.repeat(64),
    path: '/packs/curated/us-ny-commercial.lgpack.json',
  },
  {
    id: 'us-tx-residential',
    name: 'Texas residential',
    description: 'Curated residential rules for Texas.',
    jurisdictions: ['US-TX'],
    author: 'LeaseGuard core',
    fingerprint: 'c'.repeat(64),
    path: '/packs/curated/us-tx-residential.lgpack.json',
  },
];

const meta = {
  title: 'UI/MarketplacePanel',
  component: MarketplacePanel,
} satisfies Meta<typeof MarketplacePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loadManifest: () => new Promise(() => {}),
    onInstall: async () => ({ ok: true, signature: 'verified' }),
    onPreviewDiff: async () => ({ added: [], removed: [], changed: [] }),
  },
};

export const Loaded: Story = {
  args: {
    loadManifest: async () => ENTRIES,
    onInstall: async () => ({ ok: true, signature: 'verified' }),
    onPreviewDiff: async () => ({
      added: ['ca-deposit-cap'],
      removed: [],
      changed: ['auto-renew'],
    }),
  },
};

export const InvalidSignature: Story = {
  args: {
    loadManifest: async () => ENTRIES.slice(0, 1),
    onInstall: async () => ({ ok: false, signature: 'invalid' }),
    onPreviewDiff: async () => ({ added: [], removed: [], changed: [] }),
  },
};
