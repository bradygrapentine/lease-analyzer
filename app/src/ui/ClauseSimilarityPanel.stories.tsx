import type { Meta, StoryObj } from '@storybook/react';
import { ClauseSimilarityPanel } from './ClauseSimilarityPanel';
import type { ClauseCluster } from '../portfolio/clauseClusters';

const sampleClusters: ClauseCluster[] = [
  {
    clusterId: 'cluster-0001',
    representativeText:
      'This lease shall automatically renew for successive one year terms unless either party provides written notice of non-renewal at least sixty days prior to the end of the then-current term.',
    paragraphs: [
      {
        leaseId: 'lease-alpha',
        paragraphIndex: 3,
        text: 'This lease shall automatically renew for successive one year terms…',
      },
      {
        leaseId: 'lease-beta',
        paragraphIndex: 5,
        text: 'This lease shall automatically renew for successive one year terms…',
      },
    ],
  },
  {
    clusterId: 'cluster-0002',
    representativeText:
      'Tenant shall maintain commercial general liability insurance with minimum limits of one million dollars per occurrence.',
    paragraphs: [
      {
        leaseId: 'lease-alpha',
        paragraphIndex: 12,
        text: 'Tenant shall maintain commercial general liability insurance…',
      },
      {
        leaseId: 'lease-gamma',
        paragraphIndex: 8,
        text: 'Tenant shall maintain commercial general liability insurance…',
      },
    ],
  },
];

const meta: Meta<typeof ClauseSimilarityPanel> = {
  title: 'Portfolio/ClauseSimilarityPanel',
  component: ClauseSimilarityPanel,
};
export default meta;

type Story = StoryObj<typeof ClauseSimilarityPanel>;

export const Empty: Story = {
  args: {
    clusters: [],
    onOpenParagraph: () => {},
  },
};

export const WithClusters: Story = {
  args: {
    clusters: sampleClusters,
    onOpenParagraph: (leaseId, paragraphIndex) => {
      // eslint-disable-next-line no-console
      console.log('open', leaseId, paragraphIndex);
    },
  },
};
