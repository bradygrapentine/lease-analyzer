/**
 * Wave 8 Part C — leaseguard-verify reproducibility check.
 *
 * Pure function: given the bytes of a `.replay.zip` produced by the app's
 * `buildReplayBundle`, extract the contents, re-run parseLease + analyze
 * against the bundled PDF + pack, and diff the produced findings JSON
 * against the bundled `expected.json`.
 *
 * Returns `{ ok: true }` on byte-identical reproduction, otherwise
 * `{ ok: false, diff }` with a plain-text diff.
 *
 * No network. No browser globals. Node-only (uses the legacy pdf.js
 * build via the existing app parser, which works under node + vitest's
 * node environment).
 */

import { parseLease } from '../../app/src/parser/parseLease';
import { analyze } from '../../app/src/rules/analyze';
import type { Rule } from '../../app/src/rules/types';
import { extractStoreZip } from './storeZipReader';

export interface VerifyResult {
  ok: boolean;
  diff?: string;
}

interface ExpectedEnvelope {
  schema: string;
  rulePackVersion: string;
  findings: unknown[];
}

export async function verifyReplay(bundleBytes: Uint8Array): Promise<VerifyResult> {
  let entries: Map<string, Uint8Array>;
  try {
    entries = extractStoreZip(bundleBytes);
  } catch (err) {
    return {
      ok: false,
      diff: `Failed to read replay bundle as STORE zip: ${(err as Error).message}`,
    };
  }

  const pdfBytes = entries.get('lease.pdf');
  const packRaw = entries.get('pack.lgpack.json');
  const expectedRaw = entries.get('expected.json');
  if (!pdfBytes || !packRaw || !expectedRaw) {
    return {
      ok: false,
      diff: `Bundle missing one of: lease.pdf, pack.lgpack.json, expected.json (have: ${[
        ...entries.keys(),
      ].join(', ')})`,
    };
  }

  const dec = new TextDecoder();
  let expected: ExpectedEnvelope;
  let pack: unknown;
  try {
    expected = JSON.parse(dec.decode(expectedRaw)) as ExpectedEnvelope;
  } catch (err) {
    return { ok: false, diff: `expected.json is not valid JSON: ${(err as Error).message}` };
  }
  try {
    pack = JSON.parse(dec.decode(packRaw));
  } catch (err) {
    return { ok: false, diff: `pack.lgpack.json is not valid JSON: ${(err as Error).message}` };
  }

  const rules = extractRules(pack);
  if (!rules) {
    return {
      ok: false,
      diff: 'pack.lgpack.json does not contain a recognizable rules array',
    };
  }

  let actualFindings: unknown[];
  try {
    // pdfBytes is owned by us — pass a fresh copy because pdf.js may
    // detach the underlying buffer.
    const doc = await parseLease(new Uint8Array(pdfBytes));
    actualFindings = analyze(doc, rules);
  } catch (err) {
    return { ok: false, diff: `Re-running analyze threw: ${(err as Error).message}` };
  }

  const expectedJson = stableStringify(expected.findings);
  const actualJson = stableStringify(actualFindings);
  if (expectedJson === actualJson) {
    return { ok: true };
  }
  return {
    ok: false,
    diff: buildDiff(expectedJson, actualJson),
  };
}

/**
 * A `.lgpack.json` payload may be an array of packs OR a single pack
 * object. Each pack has a `rules: Rule[]` field. Concatenate them.
 */
function extractRules(pack: unknown): Rule[] | null {
  const packs = Array.isArray(pack) ? pack : [pack];
  const out: Rule[] = [];
  for (const p of packs) {
    if (!p || typeof p !== 'object') return null;
    const rules = (p as { rules?: unknown }).rules;
    if (!Array.isArray(rules)) return null;
    for (const r of rules) {
      if (!r || typeof r !== 'object') return null;
      out.push(r as Rule);
    }
  }
  return out;
}

/**
 * Deterministic JSON serializer — keys sorted at every object depth.
 * Mirrors the serializer used by `app/src/workflow/replayBundle.ts` so
 * the comparison is apples-to-apples.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

/**
 * Tiny line-oriented diff. Plain text, no color, no deps. Good enough
 * for an audit log — full structural diff is out of scope per plan.
 */
function buildDiff(expected: string, actual: string): string {
  const eLines = expected.split('\n');
  const aLines = actual.split('\n');
  const max = Math.max(eLines.length, aLines.length);
  const out: string[] = ['--- expected', '+++ actual'];
  for (let i = 0; i < max; i++) {
    const e = eLines[i];
    const a = aLines[i];
    if (e === a) continue;
    if (e !== undefined) out.push(`- ${truncate(e)}`);
    if (a !== undefined) out.push(`+ ${truncate(a)}`);
  }
  if (out.length === 2) {
    // Single-line JSON: serializer produces one line. Show both.
    out.push(`- ${truncate(expected)}`);
    out.push(`+ ${truncate(actual)}`);
  }
  return out.join('\n');
}

function truncate(s: string): string {
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}
