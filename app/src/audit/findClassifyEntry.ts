import type { AuditEntry } from './auditLog';

/**
 * Find the most recent kind:'llm-classify' audit entry matching
 * (ruleId, paragraphIndex). Returns null if none exists.
 *
 * C.1 note: AuditEntry has no `id` field. The canonical stable reference is
 * `entryHash` (SHA-256 hex of the entry's canonical JSON). Callers should use
 * `entry.entryHash` — typically sliced to 8 chars for display.
 *
 * Iterates from the tail to find the most recent match. O(n) in chain
 * length; the caller is responsible for memoisation if the chain is large.
 */
export function findClassifyEntry(
  chain: ReadonlyArray<AuditEntry>,
  ruleId: string,
  paragraphIndex: number,
): AuditEntry | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const entry = chain[i];
    if (!entry || entry.kind !== 'llm-classify') continue;
    const payload = entry.payload as { ruleId?: unknown; paragraphIndex?: unknown };
    if (payload.ruleId === ruleId && payload.paragraphIndex === paragraphIndex) {
      return entry;
    }
  }
  return null;
}
