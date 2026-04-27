#!/usr/bin/env node
// Wave 33-A — prod-deps-only audit gate with accept-risk filter.
//
// Runs `npm audit --json --omit=dev` and exits 0 iff every remaining
// vulnerability at high+ severity traces back to an advisory in
// ALLOW_ADVISORIES. Any new vulnerability not in the allowlist causes
// a non-zero exit.
//
// Allowlist entries must each be documented in docs/SECURITY.md under
// the accept-risk section with a rationale. Adding to ALLOW_ADVISORIES
// without doc is a process violation — the doc is the audit trail.

import { spawnSync } from 'node:child_process';

/** Advisory URLs for vulnerabilities the project has accepted with rationale.
 *  Each entry MUST have a corresponding §accept-risk note in docs/SECURITY.md. */
const ALLOW_ADVISORIES = new Set([
  // protobufjs <7.5.5 — arbitrary code execution. Transitive only,
  // reached via @xenova/transformers → onnxruntime-web → onnx-proto →
  // protobufjs. @xenova/transformers v2 is end-of-life upstream
  // (no fix forthcoming on that line). Migration to the successor
  // package @huggingface/transformers v4 is tracked as a future
  // Phase 19 wave with its own brainstorm — out of scope for hygiene
  // work. See docs/SECURITY.md §accept-risk for the standing
  // rationale.
  'https://github.com/advisories/GHSA-xq3m-2v4x-88gg',
]);

function collectRootUrls(name, vulns, seen) {
  const result = new Set();
  if (seen.has(name)) return result;
  seen.add(name);
  const entry = vulns[name];
  if (!entry) return result;
  for (const via of entry.via ?? []) {
    if (typeof via === 'string') {
      for (const url of collectRootUrls(via, vulns, seen)) result.add(url);
    } else if (via && typeof via.url === 'string') {
      result.add(via.url);
    }
  }
  return result;
}

function main() {
  const audit = spawnSync(
    'npm',
    ['audit', '--json', '--omit=dev', '--audit-level=high'],
    { encoding: 'utf8' },
  );

  // npm audit exits non-zero when it finds vulns; we still want to parse stdout.
  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch (err) {
    console.error('audit-prod: failed to parse `npm audit --json` output');
    console.error(audit.stdout);
    console.error(audit.stderr);
    process.exit(2);
  }

  const vulns = report.vulnerabilities ?? {};
  const offenders = [];

  for (const [name, entry] of Object.entries(vulns)) {
    if (entry.severity !== 'critical' && entry.severity !== 'high') continue;
    const rootUrls = collectRootUrls(name, vulns, new Set());
    if (rootUrls.size === 0) {
      offenders.push({ name, severity: entry.severity, roots: ['(unknown)'] });
      continue;
    }
    const allAllowed = [...rootUrls].every((url) => ALLOW_ADVISORIES.has(url));
    if (!allAllowed) {
      offenders.push({ name, severity: entry.severity, roots: [...rootUrls] });
    }
  }

  if (offenders.length === 0) {
    console.log('audit-prod: 0 unallowlisted vulnerabilities at high+ severity (prod deps).');
    process.exit(0);
  }

  console.error('audit-prod: unallowlisted vulnerabilities at high+ severity:');
  for (const o of offenders) {
    console.error(`  - ${o.name} (${o.severity}) — root advisory: ${o.roots.join(', ')}`);
  }
  console.error('');
  console.error('Either fix the dep, or — if the vuln is genuinely accept-risk —');
  console.error('add the advisory URL to ALLOW_ADVISORIES in this script AND');
  console.error('document the rationale in docs/SECURITY.md §accept-risk.');
  process.exit(1);
}

main();
