#!/usr/bin/env node
/**
 * Wave 8 Part C — fixture builder.
 *
 * Generates `cli/fixtures/sample-replay.zip`: a real STORE-only replay
 * bundle produced by the same code path the app uses
 * (`buildReplayBundle`), on a small synthetic residential lease PDF
 * built with `pdf-lib`. The resulting zip is checked in and consumed
 * by `cli/src/verifyReplay.test.ts`.
 *
 * Run:
 *   node cli/scripts/build-fixture.mjs
 *
 * This script must be re-run only if the parser/rules pipeline changes
 * the deterministic findings output for the sample fixture. Because the
 * app's reproducibility test already pins byte-stability of `analyze`,
 * the fixture is stable across CI runs as long as the rule pack stays
 * identical.
 *
 * NOTE: this script imports `.ts` files from `app/src/**` via tsx so
 * we don't have to compile app first. tsx is pulled in transitively by
 * vitest; if it's not on PATH, install with `npm i -D tsx` in cli/.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makePdf } from '../../app/src/parser/testFixtures.ts';
import { parseLease } from '../../app/src/parser/parseLease.ts';
import { analyze } from '../../app/src/rules/analyze.ts';
import { RULE_PACK_V1 } from '../../app/src/rules/packV1.ts';
import { buildReplayBundle } from '../../app/src/workflow/replayBundle.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../fixtures/sample-replay.zip');

const residentialPages = [
  {
    blocks: [
      { text: '1. Rent', x: 72, y: 72, size: 14 },
      { text: 'Tenant shall pay $2,000 on the first of each month.', x: 72, y: 110 },
      { text: '2. Term', x: 72, y: 170, size: 14 },
      { text: 'This lease shall auto-renew for successive one-year terms.', x: 72, y: 200 },
      { text: '3. Deposit', x: 72, y: 260, size: 14 },
      { text: 'Landlord may retain the security deposit for cleaning and damages.', x: 72, y: 290 },
      { text: '4. Fees', x: 72, y: 350, size: 14 },
      { text: 'Prevailing party may recover attorney fees in any dispute.', x: 72, y: 380 },
    ],
  },
];

const RULE_PACK_VERSION = '1.0.0';

const pdfBytes = await makePdf(residentialPages);
const doc = await parseLease(new Uint8Array(pdfBytes));
const findings = analyze(doc, RULE_PACK_V1);

const pack = {
  schema: 'leaseguard.pack.v1',
  id: 'leaseguard.builtin.v1',
  name: 'LeaseGuard built-in v1',
  version: RULE_PACK_VERSION,
  rules: RULE_PACK_V1,
};

const { bytes } = buildReplayBundle({
  leaseName: 'sample-residential.pdf',
  pdfBytes: new Uint8Array(pdfBytes),
  packJson: JSON.stringify(pack),
  expectedFindings: findings,
  rulePackVersion: RULE_PACK_VERSION,
});

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, bytes);
process.stdout.write(`Wrote ${OUT} (${bytes.byteLength} bytes, ${findings.length} findings)\n`);
