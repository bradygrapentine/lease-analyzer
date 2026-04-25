import { canonicalJsonStringify } from '../audit/auditLog';
import type { Rule } from './types';

/**
 * Wave 8 Part B — diff-vs-verified baseline support.
 *
 * A `BaselineDeviation` records, for a single rule id present in the
 * currently-active pack, how its canonical body fingerprint compares to
 * the fingerprint recorded in a signed baseline (typically captured at
 * the time the user verified / accepted the pack signature).
 *
 * - `id`: the rule id.
 * - `baselineFingerprint`: sha256 hex of the canonical rule body as it
 *   appeared in the signed baseline.
 * - `currentFingerprint`: sha256 hex of the canonical rule body as it
 *   appears in the pack now in use.
 * - `deviates`: convenience boolean === fingerprints differ.
 */
export interface BaselineDeviation {
  id: string;
  baselineFingerprint: string;
  currentFingerprint: string;
  deviates: boolean;
}

export interface PackBaseline {
  rules: { id: string; fingerprint: string }[];
}

/**
 * Canonical sha256 hex digest of a rule's body. Stable across machines:
 * keys are sorted at every depth before hashing.
 */
export async function hashRuleBody(rule: Rule): Promise<string> {
  const canonical = canonicalJsonStringify(rule);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return bufferToHex(digest);
}

/**
 * Compute deviation entries for the rules in `currentRules` against the
 * signed `baseline`. If no baseline is supplied, returns `[]` — there is
 * nothing to deviate from. Rules whose id is absent from the baseline
 * are reported as `deviates: false` (they're additions, not deviations).
 */
export async function resolveBaselineDeviations(
  _packId: string,
  currentRules: Rule[],
  baseline: PackBaseline | undefined,
): Promise<BaselineDeviation[]> {
  if (!baseline || !Array.isArray(baseline.rules) || baseline.rules.length === 0) {
    return [];
  }
  const baselineByid = new Map(baseline.rules.map((r) => [r.id, r.fingerprint]));
  const out: BaselineDeviation[] = [];
  for (const rule of currentRules) {
    const baselineFp = baselineByid.get(rule.id);
    const currentFp = await hashRuleBody(rule);
    if (baselineFp === undefined) {
      out.push({
        id: rule.id,
        baselineFingerprint: '',
        currentFingerprint: currentFp,
        deviates: false,
      });
      continue;
    }
    out.push({
      id: rule.id,
      baselineFingerprint: baselineFp,
      currentFingerprint: currentFp,
      deviates: baselineFp !== currentFp,
    });
  }
  return out;
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return hex;
}
