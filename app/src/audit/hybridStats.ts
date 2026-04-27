// Wave 30 Part A — pure aggregator over the audit chain that produces a
// per-rule precision summary for hybrid (LLM-classified) findings.
//
// Reads:
//   - `kind: 'llm-classify'`     → counted as a "fire" for `payload.ruleId`.
//   - `kind: 'hybrid-feedback'`  → counted as a "not-relevant" reject when
//     `payload.signal === 'not-relevant'`, keyed by `payload.ruleId`.
//
// Precision = 1 − (notRelevant / fires). When `fires === 0`, precision is
// `null` (rendered as "—" by the UI). When `notRelevant > fires` (defensive
// — shouldn't happen in practice but the audit chain is append-only and
// can predate the consumer), precision is clamped to 0.
//
// No IDB access. Caller passes already-loaded entries.

import type { AuditEntry } from './auditLog';

export interface HybridRuleStats {
  ruleId: string;
  fires: number;
  notRelevant: number;
  /** `null` when `fires === 0`. Otherwise in [0, 1]. */
  precision: number | null;
}

function readRuleId(payload: Record<string, unknown>): string | null {
  const v = payload.ruleId;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function computeHybridStats(entries: AuditEntry[]): HybridRuleStats[] {
  const fires = new Map<string, number>();
  const rejects = new Map<string, number>();

  for (const e of entries) {
    if (e.kind === 'llm-classify') {
      const id = readRuleId(e.payload);
      if (id !== null) fires.set(id, (fires.get(id) ?? 0) + 1);
    } else if (e.kind === 'hybrid-feedback') {
      if (e.payload.signal !== 'not-relevant') continue;
      const id = readRuleId(e.payload);
      if (id !== null) rejects.set(id, (rejects.get(id) ?? 0) + 1);
    }
  }

  // Union of rule ids seen in either bucket. A rule with rejects but
  // zero fires is degenerate (audit predates consumer) but we surface
  // it rather than swallowing — `fires === 0` renders as "—".
  const ids = new Set<string>([...fires.keys(), ...rejects.keys()]);
  const rows: HybridRuleStats[] = [];
  for (const ruleId of ids) {
    const f = fires.get(ruleId) ?? 0;
    const r = rejects.get(ruleId) ?? 0;
    let precision: number | null;
    if (f === 0) {
      precision = null;
    } else if (r >= f) {
      precision = 0;
    } else {
      precision = 1 - r / f;
    }
    rows.push({ ruleId, fires: f, notRelevant: r, precision });
  }
  // Stable default ordering: ruleId asc. UI re-sorts on user request.
  rows.sort((a, b) => (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0));
  return rows;
}

// ---------------------------------------------------------------------------
// Demotion-candidate helpers (Wave 31-A)
// ---------------------------------------------------------------------------

/** Minimum number of fires before a rule is considered for demotion. */
export const DEMOTION_MIN_FIRES = 10;

/** Precision ceiling (exclusive) below which a rule is a demotion candidate. */
export const DEMOTION_MAX_PRECISION = 0.70;

/**
 * Returns `true` when a rule has fired enough times to be statistically
 * meaningful AND has poor precision — signalling that the `hybridAnchors`
 * predicate is too loose. See Wave 31-A plan for action steps.
 */
export function isDemotionCandidate(stats: HybridRuleStats): boolean {
  if (stats.precision === null) return false;
  return stats.fires >= DEMOTION_MIN_FIRES && stats.precision < DEMOTION_MAX_PRECISION;
}
