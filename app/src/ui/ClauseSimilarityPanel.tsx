// Wave 10 Part B — implementation pending. Tests import from this module.
import type { ClauseCluster } from '../portfolio/clauseClusters';

export interface ClauseSimilarityPanelProps {
  clusters: ClauseCluster[];
  onOpenParagraph: (leaseId: string, paragraphIndex: number) => void;
}

export function ClauseSimilarityPanel(
  _props: ClauseSimilarityPanelProps,
): JSX.Element {
  throw new Error('ClauseSimilarityPanel: not implemented');
}
