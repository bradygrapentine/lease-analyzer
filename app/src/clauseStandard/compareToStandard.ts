// Wave 10 Part C — compare a lease against the user's standard suite.
//
// For each standard clause, find the lease paragraph with the highest
// Jaccard similarity over k-shingles. Returns one row per standard, in
// suite order, with the matched paragraphIndex (or null if nothing meets
// the threshold). Pure / synchronous so panels can call it on every render
// without an effect dance.

import type { LeaseRecord } from '../storage/storage';
import { jaccard, paragraphShingles } from '../portfolio/shingles';
import type { StandardClause } from './standardSuite';

export interface StandardComparison {
  standardId: string;
  paragraphIndex: number | null;
  similarity: number;
}

export interface CompareOptions {
  threshold?: number;
}

const DEFAULT_THRESHOLD = 0.8;

export const compareToStandard = (
  lease: LeaseRecord,
  suite: StandardClause[],
  opts?: CompareOptions,
): StandardComparison[] => {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  if (suite.length === 0) return [];

  const paragraphs = lease.doc.paragraphs;
  // Precompute paragraph shingles once — re-used across every standard.
  const paragraphShinglesCache = paragraphs.map((p) => paragraphShingles(p.text));

  return suite.map((std) => {
    const stdShingles = paragraphShingles(std.normalizedText);
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < paragraphShinglesCache.length; i++) {
      const shingles = paragraphShinglesCache[i] ?? [];
      const sim = jaccard(stdShingles, shingles);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx === -1 || bestSim < threshold) {
      return { standardId: std.id, paragraphIndex: null, similarity: bestSim };
    }
    return { standardId: std.id, paragraphIndex: bestIdx, similarity: bestSim };
  });
};
