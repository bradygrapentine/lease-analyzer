#!/usr/bin/env node
/**
 * measure-llm-budget.mjs — Phase 18 feasibility measurement.
 *
 * Phase 18 (BACKLOG: "Hybrid rules + on-device LLM") asks whether a
 * small classification head can be bundled into the precache without
 * blowing the offline-correctness contract. The current Workbox
 * precache baseline is 17 entries / 11901 KiB (Tesseract eng.traineddata
 * dominates that). This script measures the marginal cost of dropping
 * each of N candidate transformers.js models alongside it.
 *
 * Wave 17-D measured DistilBERT (Xenova/distilbert-base-uncased) at
 * 65 MiB — 5.6× the entire current precache. Wave 18-B extends the
 * script to compare DistilBERT against two smaller candidates so the
 * BACKLOG row can pick a default with real numbers, not vibes.
 *
 * Candidate justification:
 *  - Xenova/distilbert-base-uncased (baseline) — Wave 17-D's
 *    measurement; included for apples-to-apples comparison.
 *  - Xenova/all-MiniLM-L6-v2 — sentence-embedding model used widely
 *    for paragraph-level classification on top. ~22 MiB int8 expected.
 *    Phase 18 would train a thin linear head on top of these embeds.
 *  - Xenova/paraphrase-MiniLM-L3-v2 — 3-layer MiniLM (vs 6-layer L6).
 *    ~16 MiB int8 expected. The "can we ship this with the lightest
 *    precache hit" candidate. (bge-micro-v2 was the original third
 *    candidate but the Xenova port returns 401; subbed in L3.)
 *
 * Usage:
 *   node app/scripts/measure-llm-budget.mjs                 # all candidates
 *   node app/scripts/measure-llm-budget.mjs --only minilm   # one model
 *   node app/scripts/measure-llm-budget.mjs --verbose       # print URLs
 *
 * Output: a per-model summary plus a comparison table at the end,
 * suitable for pasting into the Phase 18 BACKLOG row.
 *
 * Non-goals:
 *  - This script does NOT add any model to app/public/, package.json,
 *    or the build. It writes only to a temp directory and prints
 *    numbers. Ship the chosen model in a follow-up wave once the
 *    budget gate is wired.
 */

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

// transformers.js fetches these files at runtime when you load a
// pipeline. The exact set varies per model; each candidate lists its
// own. Files that 404 on a given repo are silently skipped (some models
// don't ship a vocab.txt, some skip special_tokens_map.json, etc.).
const COMMON_FILES = [
  { rel: 'onnx/model_quantized.onnx', kind: 'weights (int8 quantized)' },
  { rel: 'tokenizer.json', kind: 'tokenizer' },
  { rel: 'tokenizer_config.json', kind: 'tokenizer-config' },
  { rel: 'config.json', kind: 'model-config' },
  { rel: 'vocab.txt', kind: 'vocab' },
  { rel: 'special_tokens_map.json', kind: 'tokens-map' },
];

const CANDIDATES = [
  {
    id: 'distilbert',
    repo: 'Xenova/distilbert-base-uncased',
    note: 'Wave 17-D baseline; smallest "real BERT" encoder.',
    files: COMMON_FILES,
  },
  {
    id: 'minilm',
    repo: 'Xenova/all-MiniLM-L6-v2',
    note: 'Sentence-embedding; train a thin classification head on top.',
    files: COMMON_FILES,
  },
  {
    id: 'minilm-l3',
    repo: 'Xenova/paraphrase-MiniLM-L3-v2',
    note: '3-layer MiniLM; smallest viable English embedder on Xenova.',
    files: COMMON_FILES,
  },
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

async function downloadOne(tmp, repoBase, file) {
  const url = `${repoBase}/${file.rel}`;
  const dest = join(tmp, file.rel.replace(/\//g, '__'));
  const res = await fetch(url, { redirect: 'follow' });
  if (res.status === 404) {
    return { ...file, url, size: 0, missing: true };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  const size = statSync(dest).size;
  return { ...file, url, size };
}

async function measureCandidate(candidate, opts) {
  const repoBase = `https://huggingface.co/${candidate.repo}/resolve/main`;
  const tmp = mkdtempSync(join(tmpdir(), `leaseguard-llm-measure-${candidate.id}-`));
  console.log(`\n[${candidate.id}] ${candidate.repo}`);
  console.log(`[${candidate.id}] ${candidate.note}`);

  const results = [];
  let totalBytes = 0;
  let failed = 0;
  let countedFiles = 0;

  for (const file of candidate.files) {
    process.stdout.write(`  fetching ${file.rel} ... `);
    try {
      const r = await downloadOne(tmp, repoBase, file);
      results.push(r);
      if (r.missing) {
        console.log('MISSING (404, skipped)');
      } else {
        totalBytes += r.size;
        countedFiles += 1;
        console.log(fmtBytes(r.size));
      }
    } catch (err) {
      failed += 1;
      console.log(`FAILED (${err instanceof Error ? err.message : String(err)})`);
      results.push({ ...file, size: 0, error: String(err) });
    }
  }

  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }

  if (opts.verbose) {
    for (const r of results) {
      if (r.url) console.log(`     ${r.url}`);
    }
  }

  return {
    id: candidate.id,
    repo: candidate.repo,
    note: candidate.note,
    countedFiles,
    failed,
    totalBytes,
    results,
  };
}

function printComparison(measurements) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(' Phase 18 — on-device classifier candidate comparison');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(
    `   Baseline precache: ${BASELINE_PRECACHE_ENTRIES} entries / ${BASELINE_PRECACHE_KIB} KiB`,
  );
  console.log('');
  // Header.
  const header = ` ${'candidate'.padEnd(12)}  ${'files'.padEnd(6)}  ${'size'.padEnd(12)}  ${'+ delta %'.padEnd(11)}  repo`;
  console.log(header);
  console.log(' ' + '─'.repeat(header.length - 1));
  for (const m of measurements) {
    const totalKiB = m.totalBytes / KB;
    const totalMiB = m.totalBytes / MB;
    const deltaPct = (totalKiB / BASELINE_PRECACHE_KIB) * 100;
    const idCol = m.id.padEnd(12);
    const filesCol = `${m.countedFiles}`.padEnd(6);
    const sizeCol = (totalBytes => {
      if (totalBytes >= MB) return `${totalMiB.toFixed(2)} MiB`;
      return `${totalKiB.toFixed(1)} KiB`;
    })(m.totalBytes).padEnd(12);
    const deltaCol = `+${deltaPct.toFixed(1)}%`.padEnd(11);
    const fail = m.failed > 0 ? ` (${m.failed} fetches failed)` : '';
    console.log(` ${idCol}  ${filesCol}  ${sizeCol}  ${deltaCol}  ${m.repo}${fail}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════');
}

async function main() {
  const verbose = argv.includes('--verbose');
  const onlyIdx = argv.indexOf('--only');
  const onlyId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

  const candidates = onlyId
    ? CANDIDATES.filter((c) => c.id === onlyId)
    : CANDIDATES;

  if (candidates.length === 0) {
    console.error(`No candidate matched --only=${onlyId}. Known ids: ${CANDIDATES.map((c) => c.id).join(', ')}`);
    exit(2);
  }

  console.log(`[measure-llm-budget] candidates: ${candidates.map((c) => c.id).join(', ')}`);

  const measurements = [];
  for (const c of candidates) {
    measurements.push(await measureCandidate(c, { verbose }));
  }

  printComparison(measurements);

  const anyFailed = measurements.some((m) => m.failed > 0);
  if (anyFailed) {
    console.error('\n[measure-llm-budget] one or more candidates had fetch failures.');
    exit(2);
  }
}

main().catch((err) => {
  console.error('[measure-llm-budget] fatal:', err);
  exit(1);
});
