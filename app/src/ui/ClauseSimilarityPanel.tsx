// Wave 10 Part B — Clause Similarity panel.
//
// Presentational only — given a list of `ClauseCluster`s and a callback,
// render each cluster with its representative text and a button per
// member paragraph that fires `onOpenParagraph(leaseId, paragraphIndex)`.
// Empty cluster list → friendly empty state. The panel does not fetch
// or compute anything; the App-level wiring is responsible for both
// shingle materialization and clustering.

import type { ClauseCluster } from '../portfolio/clauseClusters';

export interface ClauseSimilarityPanelProps {
  clusters: ClauseCluster[];
  onOpenParagraph: (leaseId: string, paragraphIndex: number) => void;
}

export function ClauseSimilarityPanel({
  clusters,
  onOpenParagraph,
}: ClauseSimilarityPanelProps): JSX.Element {
  if (clusters.length === 0) {
    return (
      <section
        aria-label="Clause similarity"
        className="clause-similarity-panel clause-similarity-panel--empty"
      >
        <h2>Clause similarity</h2>
        <p>No clause clusters yet — analyze two or more leases to see overlap.</p>
      </section>
    );
  }

  return (
    <section aria-label="Clause similarity" className="clause-similarity-panel">
      <h2>Clause similarity</h2>
      <ul className="clause-similarity-panel__list">
        {clusters.map((cluster) => (
          <li
            key={cluster.clusterId}
            className="clause-similarity-panel__cluster"
          >
            <p className="clause-similarity-panel__representative">
              {cluster.representativeText}
            </p>
            <ul className="clause-similarity-panel__members">
              {cluster.paragraphs.map((p) => (
                <li key={`${p.leaseId}:${p.paragraphIndex}`}>
                  <button
                    type="button"
                    onClick={(): void =>
                      onOpenParagraph(p.leaseId, p.paragraphIndex)
                    }
                    aria-label={`Open paragraph ${p.paragraphIndex} of ${p.leaseId}`}
                  >
                    {p.leaseId} · paragraph {p.paragraphIndex}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
