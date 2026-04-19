/**
 * Replay bundle: a portable ZIP that lets a teammate (or CI) re-run a
 * LeaseGuard analysis locally and check the output against a pinned
 * `expected.json`. Bundle is deterministic given deterministic inputs —
 * the STORE-only writer emits bytes in a fixed order with no timestamps.
 *
 * Contents:
 *   lease.pdf         — original bytes
 *   pack.lgpack.json  — serialized active rule pack(s)
 *   expected.json     — expected findings (leaseguard.findings.v1)
 *   replay.mjs        — tiny Node script with instructions
 *   README.md         — short explainer + schema pointers
 */

import type { Finding } from '../rules/types';
import { buildStoreZip } from './storeZip';

export interface ReplayBundleInput {
  leaseName: string;
  pdfBytes: Uint8Array;
  /** Serialized `.lgpack.json` of the active pack(s). */
  packJson: string;
  /** JSON-serializable findings (schema leaseguard.findings.v1). */
  expectedFindings: Finding[];
  rulePackVersion: string;
}

export interface ReplayBundleOutput {
  bytes: Uint8Array;
  /** Suggested download name, slug-based, `.replay.zip`. */
  filename: string;
}

export function buildReplayBundle(input: ReplayBundleInput): ReplayBundleOutput {
  const enc = new TextEncoder();
  const expected = {
    schema: 'leaseguard.findings.v1',
    rulePackVersion: input.rulePackVersion,
    findings: input.expectedFindings,
  };

  const bytes = buildStoreZip([
    { name: 'lease.pdf', data: input.pdfBytes },
    { name: 'pack.lgpack.json', data: enc.encode(input.packJson) },
    { name: 'expected.json', data: enc.encode(stableStringify(expected)) },
    { name: 'replay.mjs', data: enc.encode(REPLAY_SCRIPT) },
    { name: 'README.md', data: enc.encode(buildReadme(input)) },
  ]);

  return { bytes, filename: `${slug(input.leaseName)}.replay.zip` };
}

/**
 * Tiny Node script. Documentation more than code: it loads the pack and
 * PDF, then points the user at the CLI / app to actually run the rules.
 * Kept inline so the bundle has no external build step.
 */
const REPLAY_SCRIPT = `#!/usr/bin/env node
// LeaseGuard replay bundle — tiny local loader.
// Usage:
//   node replay.mjs
// This script only validates that the bundle is intact and prints next
// steps. To actually re-run the rules, load pack.lgpack.json into the
// LeaseGuard app (Rule Packs → Import) with lease.pdf, and diff the
// result against expected.json.
import { readFile } from 'node:fs/promises';

const pdf = await readFile(new URL('./lease.pdf', import.meta.url));
const pack = JSON.parse(await readFile(new URL('./pack.lgpack.json', import.meta.url), 'utf8'));
const expected = JSON.parse(await readFile(new URL('./expected.json', import.meta.url), 'utf8'));

console.log('lease.pdf bytes:', pdf.byteLength);
console.log('rule pack version:', expected.rulePackVersion);
console.log('expected findings:', expected.findings.length);
console.log('pack id(s):', Array.isArray(pack) ? pack.map((p) => p.id).join(', ') : pack.id);
console.log('\\nNext: import pack.lgpack.json into the LeaseGuard app, analyze lease.pdf,');
console.log('and compare the output to expected.json (schema leaseguard.findings.v1).');
`;

function buildReadme(input: ReplayBundleInput): string {
  return [
    '# LeaseGuard replay bundle',
    '',
    `Lease: **${input.leaseName}**`,
    `Rule pack version: \`${input.rulePackVersion}\``,
    `Expected findings: ${input.expectedFindings.length}`,
    '',
    '## Contents',
    '',
    '- `lease.pdf` — original lease PDF',
    '- `pack.lgpack.json` — serialized rule pack(s) used to produce the expected findings',
    '- `expected.json` — findings JSON, schema `leaseguard.findings.v1`',
    '- `replay.mjs` — Node helper that validates the bundle and prints next steps',
    '- `README.md` — this file',
    '',
    '## How to replay',
    '',
    '1. Run `node replay.mjs` to sanity-check the bundle.',
    '2. Open the LeaseGuard app (or a fresh build from source at the same',
    '   rule pack version).',
    '3. Import `pack.lgpack.json` via **Rule Packs → Import**.',
    '4. Analyze `lease.pdf` and compare the output JSON to `expected.json`.',
    '',
    'The `expected.json` schema id is `leaseguard.findings.v1`. Each finding',
    'carries a `rulePackVersion` stamp so drift between runs is detectable.',
    '',
  ].join('\n');
}

/**
 * Deterministic JSON serializer — keys sorted at every object depth. The
 * ZIP writer itself is deterministic, so this is the last remaining
 * source of nondeterminism.
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

function slug(name: string): string {
  const base = name.replace(/\.pdf$/i, '').trim().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'lease';
}
