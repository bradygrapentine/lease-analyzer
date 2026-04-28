# Wave 35 — Hybrid quality data → action (gated) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Wave 30→31→32 hybrid-quality observability arc into a one-shot rule-pack action: read the audit chain, identify hybrid rules whose precision is below the action threshold, and either (B) demote their anchors in `app/src/rules/packV1.ts` or (A-only) document a no-op when there isn't enough data to act.

**Architecture.** Three parts, the second and third **gated on data**: (A) a small Node-only stats script that reads an exported `leaseguard.audit.v1` JSON and prints a per-rule precision table — runs always, ships independently as a tool; (B) edit `hybridAnchors` for any rule with `fires ≥ 10` AND `precision < 0.70`, with a regression test asserting the new shape — runs **only if A finds qualifying rules**; (C) a minimal demotion-candidate review UI surfaced inside the existing `HybridPrecisionPanel` — **only if B fired meaningfully** (≥1 rule demoted). The gate is honest: with no real-world usage the wave collapses to a docs-only PR explaining why.

**Tech Stack.** Node 20 (the report script), TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, React 18 + RTL (only if Part C runs), existing `app/src/audit/hybridStats.ts` aggregator.

**Base SHA.** All parts branch from post-Wave-34 `origin/main = f4efb0f` (PR #146 merge).

**Predecessors:**
- [Wave 30-A — `HybridPrecisionPanel`](../../app/src/ui/HybridPrecisionPanel.tsx) — live UI consumer.
- [Wave 30-A — `computeHybridStats`](../../app/src/audit/hybridStats.ts) — pure aggregator over the chain.
- [Wave 31-A — demotion-candidates surfacing](../BACKLOG.md) — the panel already flags `<70% precision` rules; this wave acts on them.

---

## §0 What changed since Wave 34 (context for fresh agents)

Wave 34 (PRs #144 B, #145 A, #146 C) shipped:

- **B** — Subagent Bash-permission convention codified in `docs/CLAUDE.md`; `.claude/settings.local.json` widened to wildcards.
- **A** — Branch-coverage push to 90.5x% (no floor bump).
- **C** — Storybook dark-mode static audit; regression test extended with three new hex-literal checks. Found zero source-level regressions.

State at Wave 35 start: `origin/main = f4efb0f`, no open PRs, working tree clean. The hybrid-feedback audit kind has been live since Wave 29-C (~6 months). Volume is unknown to the orchestrator — the data only exists in the user's local IndexedDB.

## §1 Hard rules

1. **Gate is real.** If Part A's report shows zero rules with `fires ≥ 10 AND precision < 0.70`, the wave collapses to a docs-only PR documenting the no-op. Do not invent data; do not lower the thresholds to manufacture work.
2. **Demotion is anchor-edit only.** Part B touches `hybridAnchors` arrays in `app/src/rules/packV1.ts`. Do not change `match` (the deterministic matcher), `severity`, `category`, `title`, or any other rule field. Anchors are the soft signal; everything else is contract.
3. **One-and-done report.** Part A's script is a Node-only tool under `app/scripts/`. It must not import anything that needs jsdom or a browser context. No new runtime dep.
4. **Regression test for any demotion.** Each rule whose `hybridAnchors` change in Part B must gain a parameterized test row in `app/src/rules/packV1.test.ts` confirming the new anchor set still fires on the original positive fixture (i.e. the change demoted noisy anchors but kept the ground-truth path covered).
5. **No CSP / IDB schema / new third-party deps in Wave 35.** Part C, if it runs, only adds a React subtree to an existing panel.
6. **Audit-export source.** Part A reads files emitted by the existing in-app audit export (`app/src/audit/auditExport.ts`, schema `leaseguard.audit.v1`). No new export pathway, no telemetry.
7. **Decision documented in the PR description**, not just code. Part A's PR body must include: total entries, hybrid-feedback count, qualifying-rule count, and the precision table. Future readers must be able to reconstruct *why* B did or did not run.

## §2 Out of scope

- Telemetry / cloud sync / opt-in beacons (architectural non-starter; CSP forbids).
- New audit `kind` values. The two we read are `llm-classify` (fire) and `hybrid-feedback{ signal: 'not-relevant' }` (reject).
- Threshold tuning. The gate is `fires ≥ 10 AND precision < 0.70`. If no rule qualifies, the wave is done after A.
- Wave 36 transformers migration. Wave 35 ships against the existing `@xenova/transformers@2.17.2` runtime.
- Storybook visual snapshot CI (Wave 34-C BACKLOG row).
- pdf.js dark-mode page raster (Wave 34-C BACKLOG row).

## §3 Execution dependency graph

```
   ┌──────────────────────────────────┐
   │ Part A                           │
   │ Hybrid stats report (Node tool)  │
   │ + decision PR                    │
   │ (direct, this session)           │
   └──────────────┬───────────────────┘
                  │
       qualifying rules ≥ 1 ?
                  │
        ┌─────────┴─────────┐
        │ no                │ yes
        ▼                   ▼
   ┌─────────┐   ┌──────────────────────┐
   │ STOP    │   │ Part B               │
   │ wave 35 │   │ Demote hybridAnchors │
   │ closed  │   │ in packV1.ts         │
   │ as A    │   │ + regression tests   │
   │ no-op   │   └────────┬─────────────┘
   └─────────┘            │
                          │ B merged AND
                          │ user wants ongoing review?
                          │
                  ┌───────┴───────┐
                  │ no            │ yes
                  ▼               ▼
            ┌─────────┐   ┌──────────────────┐
            │ STOP    │   │ Part C           │
            │ wave 35 │   │ Review-queue UI  │
            │ closed  │   │ in HybridPrecPnl │
            │ at B    │   └──────────────────┘
            └─────────┘
```

A runs first, direct, in the orchestrator session. B and C are sequential after A's gate decision. **No parallel dispatch** — the wave is serial by design (B depends on A's output; C depends on B's PR landing).

---

## §4 File structure

### Part A
- **Create:** `app/scripts/hybrid-stats-report.mjs` — Node-only CLI. Args: `<path/to/audit-export.json>`. Output: stdout markdown table + a one-line decision summary (`ACT` or `NO-OP`).
- **Create:** `app/scripts/hybrid-stats-report.test.mjs` — fixture-based test. Three fixtures (rich, sparse, empty) covering the three decision branches.
- **Modify:** `app/package.json` — add `"hybrid:stats": "node scripts/hybrid-stats-report.mjs"` script entry.
- **Modify:** `docs/TESTING.md` — append a "Hybrid quality reporting" section pointing at the script and explaining the export-then-report flow.
- **Create:** `docs/plans/wave35-A-hybrid-stats-report.md` — embedded inside the PR body, also kept in repo as the audit artefact (PR-only OK; pick whichever fits the gate decision).

### Part B (conditional on A)
- **Modify:** `app/src/rules/packV1.ts` — for each qualifying rule, edit `hybridAnchors` (remove or constrain noisy anchors). At most 7 rules can change (current count).
- **Modify:** `app/src/rules/packV1.test.ts` — add a "post-Wave-35 demotion regression" describe-block. One `it` per demoted rule asserting the rule still fires on its existing positive fixture and does **not** fire on a synthesized noise paragraph (the one the audit data flagged as the false-positive driver).
- **Modify:** `app/src/rules/golden.test.ts` — re-run; update expected finding sets only if a demotion measurably narrows residential or commercial coverage. Document any narrowing in the PR.

### Part C (conditional on B firing)
- **Modify:** `app/src/ui/HybridPrecisionPanel.tsx` — append a "Demoted in pack v1.1" subsection listing the rules Part B changed, with their pre/post anchor sets.
- **Modify:** `app/src/ui/HybridPrecisionPanel.test.tsx` — add an empty-state test (no demotions yet) and a populated-state test.
- **Modify:** `app/src/ui/HybridPrecisionPanel.stories.tsx` — add a `WithDemotions` story.

---

## §5 Part A — Hybrid stats report (always runs)

**Branch:** `wave35-A-hybrid-stats-report`
**Worktree:** `worktrees/wave35-A-hybrid-stats-report`
**Mode:** Direct, this session.
**Cap:** 1 new script, 1 new test, 1 docs append, 1 package.json edit.

### Task A1: Set up the worktree

- [ ] **Step 1: Verify base SHA**

```bash
git fetch origin
git rev-parse origin/main
# expected: f4efb0f (or current main)
```

- [ ] **Step 2: Create worktree off origin/main**

```bash
git worktree add -b wave35-A-hybrid-stats-report worktrees/wave35-A-hybrid-stats-report origin/main
ln -s ../../app/node_modules worktrees/wave35-A-hybrid-stats-report/app/node_modules
```

### Task A2: Write the failing test first (TDD)

- [ ] **Step 1: Author three fixtures inside the test file** — no separate fixture files, keep them inline as JS literals so the test stays single-file.

```javascript
// app/scripts/hybrid-stats-report.test.mjs
import { describe, it, expect } from 'vitest';
import { computeReport, formatTable, decide } from './hybrid-stats-report.mjs';

const RICH_FIXTURE = {
  schema: 'leaseguard.audit.v1',
  entries: [
    // 12 fires of 'auto-renewal', 9 rejects → precision 0.25, qualifying
    ...Array.from({ length: 12 }, (_, i) => ({
      seq: i, timestamp: '2026-01-01T00:00:00Z',
      kind: 'llm-classify', payload: { ruleId: 'auto-renewal' },
      prevHash: null, entryHash: 'h',
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      seq: 12 + i, timestamp: '2026-01-01T00:00:00Z',
      kind: 'hybrid-feedback',
      payload: { ruleId: 'auto-renewal', signal: 'not-relevant' },
      prevHash: null, entryHash: 'h',
    })),
    // 5 fires of 'jury-trial-waiver', 0 rejects → precision 1.0, not qualifying (under fires floor)
    ...Array.from({ length: 5 }, (_, i) => ({
      seq: 30 + i, timestamp: '2026-01-01T00:00:00Z',
      kind: 'llm-classify', payload: { ruleId: 'jury-trial-waiver' },
      prevHash: null, entryHash: 'h',
    })),
  ],
};

const SPARSE_FIXTURE = {
  schema: 'leaseguard.audit.v1',
  entries: [
    // 3 hybrid fires across two rules — neither hits the fires≥10 floor
    ...Array.from({ length: 3 }, (_, i) => ({
      seq: i, timestamp: '2026-01-01T00:00:00Z',
      kind: 'llm-classify', payload: { ruleId: 'arbitration-clause' },
      prevHash: null, entryHash: 'h',
    })),
  ],
};

const EMPTY_FIXTURE = { schema: 'leaseguard.audit.v1', entries: [] };

describe('hybrid-stats-report', () => {
  it('decides ACT when ≥1 rule has fires≥10 AND precision<0.70', () => {
    const report = computeReport(RICH_FIXTURE);
    expect(decide(report)).toEqual({
      action: 'ACT',
      qualifying: ['auto-renewal'],
    });
  });

  it('decides NO-OP when no rule clears the fires floor', () => {
    expect(decide(computeReport(SPARSE_FIXTURE))).toEqual({
      action: 'NO-OP',
      qualifying: [],
    });
  });

  it('decides NO-OP on an empty audit chain', () => {
    expect(decide(computeReport(EMPTY_FIXTURE))).toEqual({
      action: 'NO-OP',
      qualifying: [],
    });
  });

  it('emits a markdown table with one row per rule seen', () => {
    const md = formatTable(computeReport(RICH_FIXTURE));
    expect(md).toContain('| ruleId | fires | rejects | precision |');
    expect(md).toContain('| auto-renewal | 12 | 9 | 0.25 |');
    expect(md).toContain('| jury-trial-waiver | 5 | 0 | 1.00 |');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails with "module not found"**

```bash
cd worktrees/wave35-A-hybrid-stats-report/app
npx vitest run scripts/hybrid-stats-report.test.mjs
```

Expected: FAIL — `Cannot find module './hybrid-stats-report.mjs'`.

### Task A3: Implement the minimal script

- [ ] **Step 1: Write `app/scripts/hybrid-stats-report.mjs`**

```javascript
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
const PRECISION_CEILING = 0.70;

export function computeReport(exportObj) {
  const fires = new Map();
  const rejects = new Map();
  for (const e of exportObj.entries ?? []) {
    if (e.kind === 'llm-classify') {
      const id = e.payload?.ruleId;
      if (typeof id === 'string') fires.set(id, (fires.get(id) ?? 0) + 1);
    } else if (e.kind === 'hybrid-feedback' && e.payload?.signal === 'not-relevant') {
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
  rows.sort((a, b) => (b.fires - a.fires) || a.ruleId.localeCompare(b.ruleId));
  return { rows };
}

export function decide(report) {
  const qualifying = report.rows
    .filter((r) => r.fires >= FIRES_FLOOR && r.precision !== null && r.precision < PRECISION_CEILING)
    .map((r) => r.ruleId);
  return { action: qualifying.length > 0 ? 'ACT' : 'NO-OP', qualifying };
}

export function formatTable(report) {
  const header = '| ruleId | fires | rejects | precision |\n| --- | --- | --- | --- |';
  const body = report.rows
    .map((r) => `| ${r.ruleId} | ${r.fires} | ${r.rejects} | ${r.precision === null ? '—' : r.precision.toFixed(2)} |`)
    .join('\n');
  return `${header}\n${body}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: hybrid-stats-report.mjs <audit-export.json>');
    process.exit(2);
  }
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  const report = computeReport(obj);
  const decision = decide(report);
  console.log(formatTable(report));
  console.log(`\nDecision: ${decision.action}`);
  if (decision.qualifying.length > 0) {
    console.log(`Qualifying rules: ${decision.qualifying.join(', ')}`);
  }
}
```

- [ ] **Step 2: Run the test suite, confirm green**

```bash
npx vitest run scripts/hybrid-stats-report.test.mjs
```

Expected: PASS — 4/4.

### Task A4: Wire the npm script and docs

- [ ] **Step 1: Add `hybrid:stats` to `app/package.json` scripts**

```json
"hybrid:stats": "node scripts/hybrid-stats-report.mjs"
```

- [ ] **Step 2: Append the export-then-report flow to `docs/TESTING.md`**

Add a section under the existing testing-quality docs that explains: (1) export the audit chain via the in-app `Export audit log` button, (2) run `npm run hybrid:stats -- /path/to/leaseguard-audit-*.json`, (3) decision is ACT or NO-OP.

### Task A5: Run the report against your local audit

- [ ] **Step 1: User exports their app's audit chain**

The user opens the running app, navigates to the audit panel, clicks `Export audit log`, saves the JSON file.

- [ ] **Step 2: Run the report, capture stdout for the PR body**

```bash
cd app
npm run hybrid:stats -- ~/Downloads/leaseguard-audit-*.json
```

- [ ] **Step 3: Decide the gate**

- If `Decision: ACT` → continue to Part B. The rule list is locked at this PR's contents.
- If `Decision: NO-OP` → Wave 35 ends after Part A merges. File a follow-up backlog row to re-run the report after a future feature drives more hybrid traffic.

### Task A6: Local gates + commit + PR

- [ ] **Step 1: Run local gates**

```bash
cd app && npm run typecheck && npm run lint && npm test
```

All green required.

- [ ] **Step 2: Commit**

```bash
git add app/scripts/hybrid-stats-report.mjs \
        app/scripts/hybrid-stats-report.test.mjs \
        app/package.json \
        docs/TESTING.md
git commit -m "wave35-A: hybrid-stats report tool + decision gate"
```

- [ ] **Step 3: Push and open the PR**

PR title: `wave35-A: hybrid-stats report + Wave 35 gate decision`. PR body must include:
- The full per-rule precision table (script stdout).
- Total entry count, hybrid-feedback count.
- The decision (ACT or NO-OP) with the qualifying rule list.
- A one-paragraph "next" pointing at Part B (if ACT) or the no-op rationale (if NO-OP).

```bash
git push -u origin wave35-A-hybrid-stats-report
gh pr create --title 'wave35-A: hybrid-stats report + Wave 35 gate decision' --body "$(cat <<'PR'
... see above template
PR
)"
gh pr merge --auto --squash
```

---

## §6 Part B — Demote noisy hybridAnchors (conditional on A)

**Branch:** `wave35-B-anchor-demotions`
**Worktree:** `worktrees/wave35-B-anchor-demotions`
**Mode:** Direct, this session, **only if Part A's PR shipped with `Decision: ACT`**.
**Cap:** ≤7 modified rules in `packV1.ts` (current count of rules with `hybridAnchors`); ≤2 modified test files.

### Task B1: Set up the worktree off post-A main

- [ ] **Step 1: Wait for Part A to merge, then sync**

```bash
git fetch origin
git checkout main
git pull --ff-only
git rev-parse origin/main  # capture the new base SHA
```

- [ ] **Step 2: Create worktree**

```bash
git worktree add -b wave35-B-anchor-demotions worktrees/wave35-B-anchor-demotions origin/main
ln -s ../../app/node_modules worktrees/wave35-B-anchor-demotions/app/node_modules
```

### Task B2: Demote each qualifying rule

For each rule in Part A's `Qualifying rules:` list, repeat the following loop. Example uses `auto-renewal` as a placeholder — replace with the actual rule ids.

- [ ] **Step 1: Identify the noise driver**

Re-open the audit export. Filter `hybrid-feedback` entries with `payload.ruleId === '<ruleId>'`. Inspect the matching `llm-classify` entries' `paragraphIndex`. Read those paragraphs in the source lease (the audit chain references the paragraph index but not its text — you may need the user's local lease library).

The "noise driver" is the substring within the qualifying paragraphs that the existing `hybridAnchors` matched on but should not have. Examples: `'transfer this lease'` matched `'transfer of property'` clauses unrelated to subletting.

- [ ] **Step 2: Author the regression-test row first (TDD)**

In `app/src/rules/packV1.test.ts`, find the existing parameterized describe block. Add a new `it` row:

```typescript
it('post-Wave-35: <ruleId> no longer fires on the noise paragraph', () => {
  const noiseParagraph = '<the paragraph text that audit flagged>';
  const findings = analyze(buildLeaseFromParagraphs([noiseParagraph]), [findRule('<ruleId>')]);
  expect(findings).toEqual([]);
});

it('post-Wave-35: <ruleId> still fires on its original positive fixture', () => {
  // Reuse the existing positive fixture for this rule.
  const findings = analyze(POSITIVE_FIXTURE_FOR['<ruleId>'], [findRule('<ruleId>')]);
  expect(findings.length).toBeGreaterThan(0);
});
```

If `findRule` and `POSITIVE_FIXTURE_FOR` helpers do not yet exist in the test file, add them as small local helpers — do not promote to a shared util in this wave.

- [ ] **Step 3: Run the noise test, confirm it fails**

```bash
cd app && npx vitest run src/rules/packV1.test.ts
```

Expected: the new "no longer fires on noise" row FAILS (the current anchors still match the noise paragraph).

- [ ] **Step 4: Edit `app/src/rules/packV1.ts` `hybridAnchors` for this rule**

Demotion options, in order of conservatism:
1. **Remove** the noisy anchor entirely (e.g. drop `'transfer this lease'`).
2. **Constrain** it to a more specific phrase (e.g. replace `'transfer'` with `'transfer the leasehold'`).
3. **Empty the array** (`hybridAnchors: []`) if every anchor is noise — the rule's deterministic `match` still fires; we lose only the LLM-classification expansion.

Pick the smallest change that makes both regression rows pass.

- [ ] **Step 5: Run both regression rows, confirm green**

```bash
npx vitest run src/rules/packV1.test.ts
```

Expected: both rows PASS.

- [ ] **Step 6: Commit per rule**

```bash
git add app/src/rules/packV1.ts app/src/rules/packV1.test.ts
git commit -m "wave35-B: demote hybridAnchors for <ruleId>"
```

### Task B3: Re-run the golden suite

- [ ] **Step 1: Run `golden.test.ts`**

```bash
npx vitest run src/rules/golden.test.ts
```

If a golden expectation changes (a residential or commercial fixture finding count moves), update the expected sets and document the narrowing in the PR body. If no change, no edit needed.

### Task B4: Local gates + PR

- [ ] **Step 1: Full gate**

```bash
cd app && npm run typecheck && npm run lint && npm test
```

- [ ] **Step 2: Push + PR**

```bash
git push -u origin wave35-B-anchor-demotions
gh pr create --title 'wave35-B: demote noisy hybridAnchors per Part A report' --body '<body>'
gh pr merge --auto --squash
```

PR body must include: which rules changed, the noise paragraph for each, and a link back to Part A's PR for the data trail.

---

## §7 Part C — Review-queue UI (optional, gated on B)

**Branch:** `wave35-C-review-queue-ui`
**Mode:** Skip by default. Only run if (a) Part B fired with ≥1 demotion AND (b) the user explicitly wants ongoing demotion-candidate review surfaced in-panel.

If skipped, file a backlog row `[ ] Hybrid demotion review-queue UI in HybridPrecisionPanel — surface rules trending toward <70% precision before they cross the line` and stop.

If run: see `app/src/ui/HybridPrecisionPanel.tsx` — add a "Demoted in pack v1.1" subsection listing the rules Part B changed with their pre/post anchor sets. New empty-state and populated-state tests in the sibling `.test.tsx`. New `WithDemotions` story. Cap: 1 component edit, 1 test edit, 1 story edit. No new audit kinds.

---

## §8 Decision matrix

| Part A outcome | Part B | Part C | Wave 35 ships as |
|---|---|---|---|
| `Decision: NO-OP` (no qualifying rules) | skipped | skipped | A only — docs PR, backlog row to re-run later |
| `Decision: ACT`, ≥1 qualifying rule | runs | skipped (default) | A + B — anchor demotions land |
| `Decision: ACT`, ≥1 qualifying rule, user wants ongoing review | runs | runs | A + B + C — full arc closes |

Most likely outcome: **A only** (no-op) unless meaningful real-world usage has accumulated. That is fine — the wave's job is to convert observability into action *only when the data justifies it*.

## §9 Self-review

- Spec coverage — all five Wave 35 design points (data check, ACT/NO-OP gate, anchor demotion, regression tests, optional UI) have at least one task.
- Placeholder scan — code blocks complete; the `<ruleId>` placeholders in §6 are intentional and replaced at runtime per Part A's qualifying list.
- Type consistency — `computeReport` / `decide` / `formatTable` signatures match between the test (Task A2) and the implementation (Task A3).

---

## §10 Handoff

Plan saved to `docs/plans/wave35-hybrid-data-action-gated.md`. Two execution options:

1. **Inline (recommended).** Wave 35 is serial by design (B depends on A, C on B); parallel dispatch wins nothing. Execute Part A directly in the current session, decide the gate from the report, continue or stop accordingly.
2. **Subagent-driven.** Dispatch Part A to a fresh Sonnet subagent with the brief from §5, then orchestrate B and C inline. Adds dispatch overhead with no parallelism payoff; pick this only if the orchestrator context is already heavy.

Default: **inline**.
