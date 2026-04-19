#!/usr/bin/env node
// Build a tiny example rule pack that users can download to try the import
// flow. Mirrors the style of `build-sample-pdf.mjs` — writes static content
// into `public/packs/` so it ships with the PWA precache.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../public/packs/example-starter.lgpack.json');

const PACK = {
  schema: 'leaseguard.rulepack.v1',
  id: 'example-starter',
  name: 'Example Starter Pack',
  version: '0.1.0',
  description:
    'Three demo rules so you can exercise the import flow. Safe to delete.',
  rules: [
    {
      id: 'example-pet-deposit',
      severity: 'low',
      category: 'finance',
      title: 'Pet deposit',
      explanation:
        'Additional deposit for pets. Confirm whether it is refundable and how it interacts with normal wear-and-tear.',
      citation: null,
      match: {
        type: 'keywordProximity',
        keywords: ['pet', 'deposit'],
        window: 40,
      },
    },
    {
      id: 'example-smoking-prohibited',
      severity: 'info',
      category: 'obligations',
      title: 'No-smoking clause',
      explanation: 'Smoking is prohibited on the premises.',
      citation: null,
      match: {
        type: 'regex',
        pattern: '\\bno[- ]smoking\\b|\\bsmoke[- ]free\\b',
        flags: 'i',
      },
    },
    {
      id: 'example-holdover-penalty',
      severity: 'high',
      category: 'termination',
      title: 'Holdover penalty',
      explanation:
        'Rent multiplier that kicks in if you stay past lease end. Often 1.5×–2× base rent.',
      citation: null,
      match: {
        type: 'keywordProximity',
        keywords: ['holdover', 'rent'],
        window: 60,
      },
    },
  ],
};

async function main() {
  const bytes = `${JSON.stringify(PACK, null, 2)}\n`;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  console.log(`wrote ${outPath} (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
