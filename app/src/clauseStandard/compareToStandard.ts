// Wave 10 Part C — implementation pending.
import type { LeaseRecord } from '../storage/storage';
import type { StandardClause } from './standardSuite';

export interface StandardComparison {
  standardId: string;
  paragraphIndex: number | null;
  similarity: number;
}

export const compareToStandard = (
  _lease: LeaseRecord,
  _suite: StandardClause[],
  _opts?: { threshold?: number },
): StandardComparison[] => {
  throw new Error('compareToStandard: not implemented');
};
