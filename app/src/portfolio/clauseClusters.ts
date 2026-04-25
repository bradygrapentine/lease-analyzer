// Wave 10 Part B — clause clustering across leases.
//
// We compute paragraph shingles for every paragraph in every lease, then
// greedy-cluster paragraphs whose pairwise Jaccard meets the threshold
// against the cluster's representative. Iteration order is stabilized by
// sorting leases by id, then by paragraphIndex within a lease, so the
// cluster ids and ordering are deterministic across runs.

import type { LeaseRecord } from '../storage/storage';
import { paragraphShingles, jaccard } from './shingles';

export interface ClusterParagraph {
  leaseId: string;
  paragraphIndex: number;
  text: string;
}

export interface ClauseCluster {
  clusterId: string;
  paragraphs: ClusterParagraph[];
  representativeText: string;
}

export interface ClusterOptions {
  threshold?: number;
  k?: number;
}

interface InternalEntry extends ClusterParagraph {
  shingles: string[];
}

interface InternalCluster {
  representative: InternalEntry;
  members: InternalEntry[];
}

export function clusterParagraphs(
  leases: LeaseRecord[],
  opts: ClusterOptions = {},
): ClauseCluster[] {
  if (leases.length === 0) return [];
  const threshold = opts.threshold ?? 0.8;
  const k = opts.k ?? 5;

  const entries: InternalEntry[] = [];
  const sortedLeases = [...leases].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const lease of sortedLeases) {
    const paragraphs = lease.doc?.paragraphs ?? [];
    paragraphs.forEach((p, idx) => {
      const text = p.text ?? '';
      const shingles = paragraphShingles(text, k);
      entries.push({
        leaseId: lease.id,
        paragraphIndex: idx,
        text,
        shingles,
      });
    });
  }

  const clusters: InternalCluster[] = [];
  for (const entry of entries) {
    let placed = false;
    for (const cluster of clusters) {
      if (entry.shingles.length === 0 && cluster.representative.shingles.length === 0) {
        // Two empty-shingle paragraphs only co-cluster on exact text equality
        // to avoid lumping every short paragraph together.
        if (entry.text === cluster.representative.text) {
          cluster.members.push(entry);
          placed = true;
          break;
        }
        continue;
      }
      const score = jaccard(entry.shingles, cluster.representative.shingles);
      if (score >= threshold) {
        cluster.members.push(entry);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ representative: entry, members: [entry] });
    }
  }

  return clusters.map((c, idx) => ({
    clusterId: `cluster-${idx.toString().padStart(4, '0')}`,
    paragraphs: c.members.map(({ leaseId, paragraphIndex, text }) => ({
      leaseId,
      paragraphIndex,
      text,
    })),
    representativeText: c.representative.text,
  }));
}
