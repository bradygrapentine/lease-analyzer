#!/usr/bin/env node
// Wave 35 Part A — Node CLI that reads an exported leaseguard.audit.v1
// JSON file and prints a per-rule precision table. Decides whether the
// rule pack qualifies for a Wave 35 Part B demotion pass.
//
// Usage:
//   node scripts/hybrid-stats-report.mjs <path/to/audit-export.json>
//
// Decision rule: ACT if any rule has fires ≥ 10 AND precision < 0.70.

import { readFileSync } from 'node:fs';

const FIRES_FLOOR = 10;
const PRECISION_CEILING = 0.7;

export function computeReport(exportObj) {
  const fires = new Map();
  const rejects = new Map();
  for (const e of exportObj.entries ?? []) {
    if (e.kind === 'llm-classify') {
      const id = e.payload?.ruleId;
      if (typeof id === 'string') fires.set(id, (fires.get(id) ?? 0) + 1);
    } else if (
      e.kind === 'hybrid-feedback' &&
      e.payload?.signal === 'not-relevant'
    ) {
      const id = e.payload?.ruleId;
      if (typeof id === 'string') rejects.set(id, (rejects.get(id) ?? 0) + 1);
    }
  }
  const ids = new Set([...fires.keys(), ...rejects.keys()]);
  const rows = [];
  for (const ruleId of ids) {
    const f = fires.get(ruleId) ?? 0;
    const r = rejects.get(ruleId) ?? 0;
    const precision = f === 0 ? null : Math.max(0, 1 - r / f);
    rows.push({ ruleId, fires: f, rejects: r, precision });
  }
  rows.sort(
    (a, b) => b.fires - a.fires || a.ruleId.localeCompare(b.ruleId),
  );
  return { rows };
}

export function decide(report) {
  const qualifying = report.rows
    .filter(
      (r) =>
        r.fires >= FIRES_FLOOR &&
        r.precision !== null &&
        r.precision < PRECISION_CEILING,
    )
    .map((r) => r.ruleId);
  return {
    action: qualifying.length > 0 ? 'ACT' : 'NO-OP',
    qualifying,
  };
}

export function formatTable(report) {
  const header =
    '| ruleId | fires | rejects | precision |\n| --- | --- | --- | --- |';
  const body = report.rows
    .map(
      (r) =>
        `| ${r.ruleId} | ${r.fires} | ${r.rejects} | ${r.precision === null ? '—' : r.precision.toFixed(2)} |`,
    )
    .join('\n');
  return body.length > 0 ? `${header}\n${body}` : `${header}\n(no rows)`;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: hybrid-stats-report.mjs <audit-export.json>');
    process.exit(2);
  }
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  const report = computeReport(obj);
  const decision = decide(report);
  const totalEntries = obj.entries?.length ?? 0;
  const feedbackCount =
    obj.entries?.filter((e) => e.kind === 'hybrid-feedback').length ?? 0;
  console.log(`Source: ${path}`);
  console.log(
    `Total entries: ${totalEntries}  ·  hybrid-feedback: ${feedbackCount}`,
  );
  console.log('');
  console.log(formatTable(report));
  console.log('');
  console.log(`Decision: ${decision.action}`);
  if (decision.qualifying.length > 0) {
    console.log(`Qualifying rules: ${decision.qualifying.join(', ')}`);
  }
}

