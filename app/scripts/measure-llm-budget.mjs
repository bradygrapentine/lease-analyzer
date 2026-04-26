#!/usr/bin/env node
/**
 * measure-llm-budget.mjs — Phase 18 feasibility measurement.
 *
 * Phase 18 (BACKLOG: "Hybrid rules + on-device LLM") asks whether a
 * small classification head can be bundled into the precache without
 * blowing the offline-correctness contract. The current Workbox
 * precache baseline is 17 entries / 11901 KiB (Tesseract eng.traineddata
 * dominates that). This script measures the marginal cost of dropping a
 * classification-capable transformers.js model alongside it.
 *
 * Why DistilBERT (Xenova/distilbert-base-uncased)?
 *  - transformers.js-compatible (ONNX quantized weights on the
 *    huggingface.co/Xenova org).
 *  - Encoder-only, classification-friendly. We do not need generative
 *    text from this layer, only paragraph-level risk classification.
 *  - The smallest "real BERT" baseline; if even this is too large the
 *    "on-device LLM" branch is a non-starter and Phase 18 should pivot
 *    to a hand-distilled head (fastText / linear-on-MiniLM-embeds).
 *
 * Usage:
 *   node app/scripts/measure-llm-budget.mjs
 *
 * Output: a summary table suitable for pasting into the BACKLOG row.
 *
 * Non-goals:
 *  - This script does NOT add the model to app/public/, package.json,
 *    or the build. It writes only to a temp directory and prints
 *    numbers. Ship the model in a follow-up wave once the budget gate
 *    is wired.
 */

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const MODEL_REPO = 'Xenova/distilbert-base-uncased';
const HF_BASE = `https://huggingface.co/${MODEL_REPO}/resolve/main`;

// transformers.js convention: quantized model + tokenizer + configs.
// These are the files transformers.js fetches at runtime when you
// `await pipeline('feature-extraction', 'Xenova/distilbert-base-uncased')`.
const FILES = [
  { rel: 'onnx/model_quantized.onnx', kind: 'weights (int8 quantized)' },
  { rel: 'tokenizer.json', kind: 'tokenizer' },
  { rel: 'tokenizer_config.json', kind: 'tokenizer-config' },
  { rel: 'config.json', kind: 'model-config' },
  { rel: 'vocab.txt', kind: 'vocab' },
  { rel: 'special_tokens_map.json', kind: 'tokens-map' },
];

// Existing precache baseline reported by the Workbox manifest at the
// time of measurement. Update if the baseline shifts.
const BASELINE_PRECACHE_ENTRIES = 17;
const BASELINE_PRECACHE_KIB = 11901;

const KB = 1024;
const MB = 1024 * 1024;

function fmtBytes(n) {
  if (n >= MB) return `${(n / MB).toFixed(2)} MiB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KiB`;
  return `${n} B`;
}

async function downloadOne(tmp, file) {
  const url = `${HF_BASE}/${file.rel}`;
  const dest = join(tmp, file.rel.replace(/\//g, '__'));
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  const size = statSync(dest).size;
  return { ...file, url, size };
}

async function main() {
  const verbose = argv.includes('--verbose');
  console.log(`[measure-llm-budget] target model: ${MODEL_REPO}`);
  console.log(`[measure-llm-budget] base url:     ${HF_BASE}`);

  const tmp = mkdtempSync(join(tmpdir(), 'leaseguard-llm-measure-'));
  console.log(`[measure-llm-budget] tmp dir:      ${tmp}`);

  const results = [];
  let totalBytes = 0;
  let failed = 0;

  for (const file of FILES) {
    process.stdout.write(`  fetching ${file.rel} ... `);
    try {
      const r = await downloadOne(tmp, file);
      results.push(r);
      totalBytes += r.size;
      console.log(fmtBytes(r.size));
    } catch (err) {
      failed += 1;
      console.log(`FAILED (${err instanceof Error ? err.message : String(err)})`);
      results.push({ ...file, size: 0, error: String(err) });
    }
  }

  // Cleanup tmp dir — measurement only.
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }

  const totalKiB = totalBytes / KB;
  const totalMiB = totalBytes / MB;
  const newPrecacheKiB = BASELINE_PRECACHE_KIB + totalKiB;
  const newEntries = BASELINE_PRECACHE_ENTRIES + FILES.length;
  const deltaPct = (totalKiB / BASELINE_PRECACHE_KIB) * 100;

  console.log('');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(' Phase 18 — on-device LLM precache measurement');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(` Model:                ${MODEL_REPO}`);
  console.log(` Files measured:       ${FILES.length}`);
  console.log(` Files downloaded:     ${FILES.length - failed}`);
  console.log('');
  console.log(' Per-file breakdown:');
  for (const r of results) {
    const pad = r.kind.padEnd(28, ' ');
    const size = r.error ? `ERROR (${r.error})` : fmtBytes(r.size);
    console.log(`   ${pad} ${size}`);
    if (verbose && r.url) console.log(`     ${r.url}`);
  }
  console.log('');
  console.log(` Total model bytes:    ${fmtBytes(totalBytes)}  (${totalKiB.toFixed(1)} KiB / ${totalMiB.toFixed(2)} MiB)`);
  console.log('');
  console.log(' Precache impact:');
  console.log(`   Baseline (today):   ${BASELINE_PRECACHE_ENTRIES} entries / ${BASELINE_PRECACHE_KIB} KiB`);
  console.log(`   Would-add delta:    +${FILES.length} entries / +${totalKiB.toFixed(1)} KiB`);
  console.log(`   New total:          ${newEntries} entries / ${newPrecacheKiB.toFixed(1)} KiB`);
  console.log(`   Delta as % of base: +${deltaPct.toFixed(1)}%`);
  console.log('──────────────────────────────────────────────────────────────');

  if (failed > 0) {
    console.error(`\n[measure-llm-budget] ${failed} file(s) failed to download.`);
    exit(2);
  }
}

main().catch((err) => {
  console.error('[measure-llm-budget] fatal:', err);
  exit(1);
});
