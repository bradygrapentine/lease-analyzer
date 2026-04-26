# Wave 22 — Hybrid-finding audit kind + branch-coverage push + BACKLOG reconcile

**Goal:** three bounded cleanups that close out the housekeeping
half of the Phase 18 / decomp arc. Adds a distinguishing audit
`kind` for hybrid (LLM-derived) findings now that the seam is
in place, finally lands the contingent branch-threshold bump that
Waves 18-C / 19-B / 20-C / 21-C all skipped, and reconciles the
App.tsx-decomposition row in BACKLOG (now at 541 lines, comfortably
below the 600 target).

The **real Phase 18 model integration** (wiring a non-null
`embedFn` in `usePipeline`, Workbox precaching the MiniLM-L3
weights, CSP impact audit in real Chrome, paraphrased-clause golden
test against the real model) is **out of scope** here — that's
**Wave 23**, queued explicitly. Wave 22 stays in the small-parts
lane.

## Scope boundary

Wave 22 owns:

- `app/src/rules/hybridAnalyze.ts` (Part A — single writer for the
  new audit hook), `app/src/rules/hybridAnalyze.test.ts` (Part A).
- `app/src/audit/auditLog.ts` only if the new `kind` requires a
  literal-type widening; otherwise the kind is free-form per
  CLAUDE.md and no edit is needed.
- `docs/CLAUDE.md` (Part A — add the new `kind` to the documented
  list).
- New tests under `app/src/**/*.test.ts(x)` (Part B; ≤ 4 new test
  files, ≤ 20 new cases).
- `app/vite.config.ts` (Part B only — branch threshold 88→89).
- `docs/TESTING.md` (Part B only — actuals refresh).
- `docs/BACKLOG.md` (Part C only — App.tsx-decomposition row flip,
  current-footprint table refresh).
- `docs/ROADMAP.md` (Part C only — tech-debt section refresh).

Wave 22 does **NOT** touch:

- `app/src/llm/loadClassifier.ts` (Wave 23 wires it in — Wave 22
  leaves the stub alone).
- `app/src/App/usePipeline.ts` — Wave 21-A's edit stays as-is. The
  audit-kind addition in Part A flows through `runHybridAnalyze`'s
  return path, not through a usePipeline rewrite.
- Workbox / `vite-plugin-pwa` config (Wave 23 lands the precache).
- `app/index.html` CSP `<meta>` tag (Wave 23 audits + adjusts if
  needed).
- IDB schema; no DB version bump.
- New product UI; no new buttons.

## Pre-flight

1. Wave 21 (A/B + plan; C SKIPPED) merged. Wave 22 starts from
   `main` at or after Wave 21-B's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`.
3. Verify branches actual is still **89.08%** post-Wave-21-B. If
   it's already ≥ 89.5% from a sibling commit, Part B's threshold
   bump simplifies (don't add tests purely to inflate it).
4. Verify `app/src/App.tsx` is **541 lines**. The Part C row flip
   asserts "below the 600 target" — recompute the rationale if
   App.tsx drifted.
5. Read each part's cap before starting. Caps are contracts.

## Parts (A, B, C parallel-safe by file ownership)

### Part A — `kind: 'llm-classify'` audit entry per hybrid finding

**Branch:** `wave22-llm-classify-audit`

**Cap:** **1 src edit** (`app/src/rules/hybridAnalyze.ts` —
extends the API to accept an optional `audit` callback) +
**existing test file edits** (no new test files; ≤ 4 new test
cases). **1 doc edit** (`docs/CLAUDE.md` — add `'llm-classify'`
to the audit-kinds list). **No new audit-log schema changes**:
`kind` is already a free-form string per CLAUDE.md.

**Approach:**

`runHybridAnalyze` currently emits hybrid findings with no
attestation in the audit log. Part A extends the API:

```
runHybridAnalyze({
  ...,
  audit?: (entry: { kind: string; payload: Record<string, unknown> }) => Promise<void>,
});
```

For each hybrid finding emitted (i.e. each finding whose
`confidence === 0.5` from the classifier path), the wrapper fires
one `kind: 'llm-classify'` audit entry with payload
`{ ruleId, paragraphIndex, modelId, similarity }`. When `audit` is
not supplied or the flag is off, no audit entries fire (same
contract as today's hybrid findings being absent).

`usePipeline.ts` is **not edited in this part** — Wave 23's
real-model integration will pass `safeAudit` as the `audit`
callback when it wires `embedFn`. Wave 22-A just ships the seam
+ tests.

**Files:**

- `app/src/rules/hybridAnalyze.ts` — add the `audit` option to
  `HybridAnalyzeOptions`, fire one `'llm-classify'` entry per
  hybrid finding emitted, include `modelId` (defaults to
  `'unknown'` if not supplied — passed through from a new
  optional `modelId` field).
- `app/src/rules/hybridAnalyze.test.ts` — extend with ≤ 4 cases:
  - With `audit` supplied + flag on + stub embedder: each hybrid
    finding emits exactly one `'llm-classify'` entry.
  - With `audit` supplied + flag off: no entries fire.
  - With `audit` supplied + flag on + zero hybrid findings: no
    entries fire.
  - The audit payload includes `ruleId`, `paragraphIndex`,
    `modelId`, and a numeric `similarity`.
- `docs/CLAUDE.md` — add `llm-classify` to the audit-kinds list
  alongside `analyze`, `export`, `save-lease`, etc.

**Tests / verify:**

- `npm run typecheck && npm run lint && npm run test:coverage`
  green; no threshold drops.
- Existing hybridAnalyze tests pass unchanged (the new option is
  purely additive).
- `usePipeline.test.ts` passes unchanged (no edit there).

**Out of scope:** wiring `safeAudit` into `usePipeline`'s
`runHybridAnalyze` call (Wave 23); IDB schema additions for the
new kind (`kind` is free-form); UI surface for hybrid-finding
attestation (Wave 23+).

### Part B — branch-coverage targeted push + threshold bump 88 → 89

**Branch:** `wave22-coverage-push`

**Cap:** **≤ 4 new test files** OR existing-file extensions, **≤ 20
new test cases combined**. **0 production-source edits** beyond
test file additions. Threshold bump 88→89 conditional on post-A+B
actual ≥ 89.5% (the same buffer rule that skipped four prior
waves).

**Approach:**

Branch coverage is at 89.08% post-Wave-21-B. Need ~+13 covered
branches to clear 89.5% (89.5% × 3225 ≈ 3066 covered; current
2871). The lowest-hanging targets after Waves 17-21:

| file | likely missed | strategy |
|------|----|----|
| `rules/hybridAnalyze.ts` | ~10 (defensive `?? ''`, similarity-zero, empty paragraph cases) | direct unit tests on edge cases |
| `llm/featureFlag.ts` | ~3 (try/catch on URL parsing, missing window) | jsdom global stubs |
| `ui/AppLibraryAndPacksPane.tsx` | ~5 (comparison-mismatch render branch, packs.packDiff truthy branch) | RTL fixtures |
| `ui/AppCurrentPane.tsx` | ~5 (selected-finding render, ocrState=running render) | RTL fixtures |

Pick **2-3 of these** for ~+15-20 covered branches. Skip files
where the missed branches are `noUncheckedIndexedAccess`
defensive-only — those are runtime-unreachable.

**Files:**

- New / extended test files for the picked targets. Total ≤ 4 new
  files (or ≤ 4 extensions of existing tests).
- `app/vite.config.ts` — `branches: 88` → `branches: 89` IFF
  post-A+B actual ≥ 89.5%.
- `docs/TESTING.md` — refresh actuals + threshold paragraph.

**Tests / verify:**

- `npm run test:coverage` shows branches ≥ 89.5%.
- Threshold floor in `vite.config.ts` matches.
- All new tests pass cleanly; no flakes under coverage
  instrumentation.

**Out of scope:** statements / functions / lines floor bumps
(those have headroom); pushing for branches ≥ 90 (Wave 23+);
writing tests for files already > 92% branches.

### Part C — BACKLOG / ROADMAP reconcile

**Branch:** `wave22-backlog-reconcile`

**Cap:** **≤ 6 doc-edit blocks** across `docs/BACKLOG.md` and
`docs/ROADMAP.md`. **No new rows.** **The App.tsx-decomposition
row CAN flip** `[ ]` → `[x]` because the underlying ≤600-line
target is genuinely met (App.tsx is 541 lines as of Wave 21-B).
Other flips are stale-text fixes only.

**Approach:**

Targets (verified with grep before edit):

- BACKLOG current-footprint table:
  - "Tests" line: `~1123` → `~1189` (post-Wave-21).
  - "Coverage thresholds" line: refresh actual percentages.
  - "App.tsx" row: re-described to reflect the post-Wave-21-B
    state (12 hooks extracted; 4 sub-components extracted; App.tsx
    541 lines).
- BACKLOG tech-debt section:
  - **App.tsx decomposition row**: flip `[ ]` → `[x]` with a
    landing summary covering Waves 17-A through 21-B.
- ROADMAP tech-debt section:
  - "Continue App.tsx decomposition" bullet: re-frame as "App.tsx
    decomposition closed in Waves 17-21 (~600 line target met)"
    or remove if the bullet was the only one; the surrounding
    section reads cleanly without it.

**Files:**

- `docs/BACKLOG.md` — current-footprint table edits + tech-debt
  row flip.
- `docs/ROADMAP.md` — tech-debt bullet refresh / removal.

**Tests / verify:**

- `prettier --check` clean on both files.
- `git diff main..HEAD --stat` shows only `docs/BACKLOG.md` and
  `docs/ROADMAP.md`.
- The App.tsx row flip cites the underlying merged Wave PRs
  (#71, #74, #77, #80, #84) so the rationale is auditable.

**Out of scope:** row flips for any other "in progress" rows;
adding new rows (Wave 16-C used the row-add budget already);
reorganizing phases.

## Merge order

A and B touch disjoint files (A: `rules/`; B: `vite.config.ts`,
test files; some test-file overlap is possible if Part B picks
`hybridAnalyze.test.ts` as a target — coordinate via PR
description). C is doc-only. Suggested:

```
A, B  (parallel-safe; coordinate hybridAnalyze.test.ts if both
       want to extend it)
   ↓
C    (lands last to absorb actuals from A+B)
```

If Part B picks `hybridAnalyze.test.ts` as a coverage target AND
Part A is also editing it, ship A first, then B rebases and
extends.

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has small
judgment calls (which test files to extend in B, what the row-flip
rationale should say in C, how chatty the audit payload should be
in A) that benefit from product context. None are big enough to
dispatch.

## Done definition

- Part A merged: `runHybridAnalyze` accepts an optional `audit`
  callback and fires `kind: 'llm-classify'` per hybrid finding;
  CLAUDE.md documents the new kind.
- Part B merged: branches floor at 89 IFF actual ≥ 89.5%; new
  tests added; thresholds doc updated. SKIPS with a documented
  actual otherwise.
- Part C merged: App.tsx-decomposition row flipped `[x]` with
  landing summary; current-footprint table reflects reality.
- All thresholds held; no behavior changes outside hybrid path's
  new audit attestation; no model fetched; no new product UI; no
  new dep.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | 1 src edit + ≤ 4 test cases + 1 doc line; no new audit-log schema; no `usePipeline` edit |
| B | ≤ 4 new test files / ≤ 20 cases; threshold bump only if branches ≥ 89.5%; 0 src edits |
| C | ≤ 6 doc-edit blocks; 1 row flip (justified); 0 new rows |

If a cap is breached, ship what fits and roll the overflow to
Wave 23. Do not negotiate caps up from inside a part.

## Wave 23 preview (out of scope here, queued)

The real Phase 18 model integration is its own multi-part wave:

- Wire `loadClassifier` so `embedFn` flows into `runHybridAnalyze`
  with the actual MiniLM-L3 weights.
- Build-time download of model weights into `app/public/classifier/`
  + `vite-plugin-pwa` glob update so Workbox precaches them.
- CSP impact audit in a real Chrome (transformers.js may need
  `'wasm-unsafe-eval'` in `script-src`); update `app/index.html`
  if so + extend `npm run check:csp`.
- Paraphrased-clause golden test — likely a Playwright e2e since
  jsdom can't run ONNX runtime + WebGPU.
- Per-finding `evidence: { tokens, modelId, similarity }` field on
  `Finding` (the BACKLOG row from Wave 16-C). Schema + serializer
  updates.

That's 5 sub-parts — far past Wave 22's scope. Wave 22 stays
clean; Wave 23 plans the integration carefully.
