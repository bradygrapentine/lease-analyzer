import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClauseSimilarityPanel } from './ClauseSimilarityPanel';
import type { ClauseCluster } from '../portfolio/clauseClusters';

const CLUSTERS: ClauseCluster[] = [
  {
    clusterId: 'c-001',
    representativeText: 'Auto-renewal clause text representative.',
    paragraphs: [
      {
        leaseId: 'L1',
        paragraphIndex: 2,
        text: 'Auto-renewal clause text representative.',
      },
      {
        leaseId: 'L2',
        paragraphIndex: 4,
        text: 'Auto-renewal clause text variant.',
      },
    ],
  },
  {
    clusterId: 'c-002',
    representativeText: 'Indemnification clause representative.',
    paragraphs: [
      {
        leaseId: 'L1',
        paragraphIndex: 5,
        text: 'Indemnification clause representative.',
      },
      {
        leaseId: 'L3',
        paragraphIndex: 1,
        text: 'Indemnification clause variant.',
      },
    ],
  },
];

describe('ClauseSimilarityPanel', () => {
  it('renders an empty state when no clusters are present', () => {
    render(
      <ClauseSimilarityPanel clusters={[]} onOpenParagraph={() => {}} />,
    );
    expect(screen.getByText(/no clause clusters/i)).toBeInTheDocument();
  });

  it('renders one entry per cluster with the representative text', () => {
    render(
      <ClauseSimilarityPanel
        clusters={CLUSTERS}
        onOpenParagraph={() => {}}
      />,
    );
    expect(
      screen.getByText(/Auto-renewal clause text representative/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Indemnification clause representative/i),
    ).toBeInTheDocument();
  });

  it('lists each lease+paragraph in a cluster', () => {
    render(
      <ClauseSimilarityPanel
        clusters={CLUSTERS}
        onOpenParagraph={() => {}}
      />,
    );
    // Both L1 (paragraph 2) and L2 (paragraph 4) should appear via accessible labels.
    expect(
      screen.getByRole('button', {
        name: /open paragraph 2 of L1/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /open paragraph 4 of L2/i,
      }),
    ).toBeInTheDocument();
  });

  it('fires onOpenParagraph(leaseId, paragraphIndex) when a paragraph is clicked', async () => {
    const onOpenParagraph = vi.fn();
    render(
      <ClauseSimilarityPanel
        clusters={CLUSTERS}
        onOpenParagraph={onOpenParagraph}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: /open paragraph 4 of L2/i,
      }),
    );
    expect(onOpenParagraph).toHaveBeenCalledWith('L2', 4);
  });
});
