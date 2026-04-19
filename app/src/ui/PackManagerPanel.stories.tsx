import type { Meta, StoryObj } from '@storybook/react';
import { PackManagerPanel } from './PackManagerPanel';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from '../rules/packSchema';

const examplePack: RulePackFile = {
  schema: RULE_PACK_SCHEMA_VERSION,
  id: 'ca-tenant-starter',
  name: 'California Tenant Starter',
  version: '0.1.0',
  description: 'Three extra residential-tenant rules tuned for California.',
  rules: [
    {
      id: 'ca-security-deposit-cap',
      severity: 'medium',
      category: 'finance',
      title: 'Security deposit cap (CA)',
      explanation: 'California caps unfurnished deposits at two months’ rent.',
      citation: 'Cal. Civ. Code § 1950.5',
      match: { type: 'keywordProximity', keywords: ['security', 'deposit'], window: 40 },
    },
    {
      id: 'ca-notice-to-enter',
      severity: 'low',
      category: 'obligations',
      title: 'Landlord notice to enter',
      explanation: 'CA requires 24-hour notice before most landlord entries.',
      citation: null,
      match: { type: 'regex', pattern: '\\b24[- ]?hour(?:s)?\\b', flags: 'i' },
    },
  ],
};

const extraPack: RulePackFile = {
  ...examplePack,
  id: 'commercial-extras',
  name: 'Commercial Extras',
  version: '0.2.0',
  description: 'CAM caps, relocation clauses, and holdover penalties.',
};

const meta = {
  title: 'UI/PackManagerPanel',
  component: PackManagerPanel,
  args: {
    builtInName: 'LeaseGuard v1',
    onImport: async () => {},
    onToggle: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof PackManagerPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    installed: [],
    enabled: new Set(),
  },
};

export const TwoInstalledOneEnabled: Story = {
  args: {
    installed: [examplePack, extraPack],
    enabled: new Set([examplePack.id]),
  },
};
