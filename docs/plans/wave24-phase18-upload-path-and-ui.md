# Wave 24 — Phase 18 upload-path + UI surface + coverage cleanup

**Goal:** finish the Phase 18 product story by extending the
hybrid path to the **regular upload** flow (not just OCR), put a
visible UI cue on hybrid findings so users can tell deterministic
from LLM-derived hits, and finally land the contingent branch-
threshold bump after one focused defensive-guard cleanup pass.

The Playwright golden test against the real model rolls **once
more** to Wave 25 — it remains the riskiest piece (model fetch in
CI, headless WebGPU/WASM availability) and benefits from having
the upload path stable first.

## Scope boundary

Wave 24 owns:

- `app/src/rules/hybridAnalyze.ts` (Part A — refactor extracts
  the classifier pass into a standalone export; the existing
  `runHybridAnalyze` wrapper stays).
- `app/src/rules/hybridAnalyze.test.ts` (Part A).
- `app/src/App/usePipeline.ts` (Part A — single edit: the
  `upload` callback runs the classifier pass after the worker
  returns deterministic findings).
- `app/src/App/usePipeline.test.ts` (Part A).
- `app/src/ui/FindingsPanel.tsx` (Part B — adds the
  hybrid-attestation badge).
- `app/src/ui/FindingsPanel.test.tsx` (Part B).
- `app/src/rules/hybridAnalyze.ts` and `app/src/rules/types.ts`
  (Part C — drops unreachable defensive guards if and only if
  static analysis confirms they're unreachable).
- `app/vite.config.ts` (Part C — branches threshold bump 88→89,
  contingent on actuals).
- `docs/TESTING.md` (Part C — actuals refresh).
- `docs/CLAUDE.md` (Part B — one line for the new badge).

Wave 24 does **NOT** touch:

- The Web Worker source (`app/src/worker/leaseWorker.ts`). Part A
  keeps the worker on deterministic-only and runs the classifier
  pass on the main thread after the worker returns. Loading
  `@xenova/transformers` inside the worker context is its own
  separate decision (ONNX Runtime Web's WebGPU backend doesn't
  run in workers; the WASM backend does, but it competes with
  pdf.js and OCR for worker-thread time). Wave 25+ revisits if
  needed.
- IDB schema; no new audit `kind` strings.
- Playwright e2e — Wave 25.
- Real Chrome runtime CSP verification — Wave 25.
- New product features beyond the badge (no new buttons, no new
  panels, no UI to toggle the flag — the flag stays
  developer-only via URL / localStorage).

## Pre-flight

1. Wave 23 (A/B/C + plan) merged. Wave 24 starts from `main` at
   or after Wave 23-C's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green; combined OCR + classifier
   precache reports its expected size when the model is dropped
   (~26 MiB / 30 MiB cap).
3. Verify `app/src/rules/hybridAnalyze.ts`'s `runHybridAnalyze`
   still calls `analyze()` first then runs the classifier pass —
   Part A's refactor needs that exact shape to extract cleanly.
4. Verify branches actual is **89.37%** post-Wave-23. Part C is
   contingent on post-A+B+C actual ≥ 89.5%.
5. Read each part's cap before starting. Caps are contracts.

## Parts (A is precondition for B; C parallel-safe with both)

### Part A — hybrid classifier pass on the upload path

**Branch:** `wave24-upload-hybrid`

**Cap:** **2 src edits** (`hybridAnalyze.ts` extract +
`usePipeline.ts` upload-path edit) + **2 test extensions**. **No
new files.** **Worker source untouched.** **No behavior change
when the flag is off** — the upload path stays
byte-identical-to-Wave-23 in the default case.

**Approach:**

`runHybridAnalyze` today does `analyze() + classifier pass` in
one function. The OCR path consumes both phases together because
it has to (it needs `analyze()` to run inline; jsdom can't go
through the worker). The upload path **already runs `analyze()`
inside the worker** via `pipelineClient.parseAndAnalyze` and
returns deterministic findings to the main thread. Asking the
upload path to call `runHybridAnalyze` on top would re-run
`analyze()` redundantly — wasteful, and on a large lease the
per-paragraph regex pass is non-trivial.

Refactor:

```ts
// New export — runs ONLY the classifier pass, given pre-computed
// base findings. runHybridAnalyze becomes a thin wrapper that
// calls analyze() then runClassifierPass.
export async function runClassifierPass(opts: {
  doc: LeaseDocument;
  rules: Rule[] | CompiledRule[];
  baseFindings: Finding[];
  embedFn: EmbedFunction;
  threshold?: number;
  maxLlmCalls?: number;
  audit?: (entry: { kind: string; payload: Record<string, unknown> }) => Promise<void> | void;
  modelId?: string;
}): Promise<Finding[]>;
```

`runClassifierPass` returns the **delta** (extras only). Caller
concats `[...baseFindings, ...extras]`. `runHybridAnalyze` is now:

```ts
export async function runHybridAnalyze(opts) {
  const baseFindings = analyze(opts.doc, opts.rules);
  if (!opts.enabled || !opts.embedFn) return baseFindings;
  const extras = await runClassifierPass({
    doc: opts.doc,
    rules: opts.rules,
    baseFindings,
    embedFn: opts.embedFn,
    threshold: opts.threshold,
    maxLlmCalls: opts.maxLlmCalls,
    audit: opts.audit,
    modelId: opts.modelId,
  });
  return [...baseFindings, ...extras];
}
```

`usePipeline.upload` then runs `runClassifierPass` after the
worker returns:

```ts
const result = await client.parseAndAnalyze(bytes, activeRules);
let augmented = result;
if (isPhase18Enabled()) {
  const embedFn = await loadClassifierEmbedFn();
  if (embedFn) {
    const extras = await runClassifierPass({
      doc: result.doc,
      rules: activeRules,
      baseFindings: result.findings,
      embedFn,
      audit,
      modelId: DEFAULT_MODEL_ID,
    });
    augmented = { doc: result.doc, findings: [...result.findings, ...extras] };
  }
}
// ...rest of upload flow uses `augmented` instead of `result`.
```

**Files:**

- `app/src/rules/hybridAnalyze.ts` — extract `runClassifierPass`
  as a new export; thin `runHybridAnalyze` wrapper around it.
  Behavior **byte-identical** when called via the wrapper.
- `app/src/rules/hybridAnalyze.test.ts` — add 2 cases pinning
  `runClassifierPass` directly: returns delta only when given
  pre-computed `baseFindings`; never duplicates findings against
  paragraphs that already have one.
- `app/src/App/usePipeline.ts` — single-edit-point change in the
  `upload` callback: thread the classifier pass before
  `setStatus` / `saveLease` / auto-compare.
- `app/src/App/usePipeline.test.ts` — add 2 cases:
  - flag on + classifier loads → upload returns hybrid findings
    appended (uses a stub embedder injected via test-only seam).
  - flag on + classifier load fails → upload returns deterministic
    findings unchanged (no error surfaced).

**Tests / verify:**

- `runHybridAnalyze`'s existing 13 test cases pass unchanged
  (the wrapper is bytes-equivalent to today).
- New `runClassifierPass` tests pin the standalone shape.
- `usePipeline.test.ts` upload tests pass; the 2 new flag-on
  cases exercise the new code path (with a stubbed embedder
  injected via a new optional `pipelineClient`-style test seam).
- Coverage thresholds hold (no drop below 95/88/91/95).
- Bundle budget unchanged.

**Out of scope:** running the classifier inside the Web Worker
(Wave 25+ if ever); modifying `pipelineClient`'s contract;
adding a new audit `kind`.

### Part B — hybrid-finding UI badge

**Branch:** `wave24-hybrid-badge`

**Cap:** **1 src edit** (`FindingsPanel.tsx` only) + **1 test
extension**. **1 doc line** in `CLAUDE.md`. **No new files.** No
new translations, no new ARIA roles, no schema changes — the
badge is a CSS class with a `title` / `aria-label` annotation and
no other side effects.

**Approach:**

Findings emitted by the classifier pass carry
`evidence: { modelId, similarity }` (Wave 23-C). FindingsPanel
renders each finding row but doesn't currently distinguish
deterministic from hybrid. Part B adds a small visual cue:

- Findings with `evidence` present render a `<span
  className="finding-llm-badge" aria-label="Identified by
  on-device classifier (similarity {pct}%)">…</span>` next to
  the title.
- The `aria-label` includes the similarity percentage so screen
  readers convey provenance.
- Visible glyph is a single Unicode mark (e.g. `~`) inside a
  small badge container; CSS for the badge stays minimal —
  border + tooltip-via-`title`. No new CSS file, no new image.

**Files:**

- `app/src/ui/FindingsPanel.tsx` — render the badge when
  `finding.evidence` is set.
- `app/src/ui/FindingsPanel.test.tsx` — add 2 cases:
  - Deterministic finding (no `evidence`) renders no badge.
  - Hybrid finding (with `evidence`) renders the badge with the
    similarity percentage in the `aria-label`.
- `docs/CLAUDE.md` — one line in the existing FindingsPanel /
  Adding-a-panel guidance noting the badge contract for hybrid
  findings.

**Tests / verify:**

- `FindingsPanel.test.tsx` existing cases pass unchanged
  (additive change).
- A11y gate (Wave 14-D's `vitest-axe`) stays green — the badge
  uses a real `aria-label` and is not a button / link.
- Storybook stories (`FindingsPanel.stories.tsx`) pick up the
  new state if a hybrid fixture is added; if the existing
  stories don't need it, leave them alone.

**Out of scope:** a click-to-explain affordance ("why was this
flagged?"); rendering the `modelId` (the `aria-label` is enough
— exposing the raw `Xenova/...` string in plain UI is noisy);
i18n for the new label (one English string is fine for now;
i18n can pick it up later via the existing `useI18n` flow).

### Part C — defensive-guard cleanup + threshold bump 88 → 89

**Branch:** `wave24-defensive-guard-cleanup`

**Cap:** **≤ 5 src files** with defensive-guard removals (each
removal must be a `?? <default>` / `!x || !y` path that **static
analysis** says is runtime-unreachable given the current
codepaths). **0 new files.** **0 new tests.** Threshold bump
88→89 conditional on post-A+B+C actual ≥ 89.5%; SKIP otherwise.

**Approach:**

The branch-threshold buffer has been blocked for **6 waves**
(18-C, 19-B, 20-C SKIPPED; 21-C / 22-B / 23 also short of 89.5%)
because every refactor adds defensive `?? ''` / `!x || !y`
guards that v8 counts as branches but that runtime cannot reach.
Part C audits the worst-offending guards and drops the ones that
are demonstrably unreachable.

Method: for each candidate guard, write a one-paragraph
rationale in the commit body — "this guard fires only when X
which can't happen because Y" — and remove the guard. If the
rationale doesn't hold up under inspection, leave the guard.
**Don't drop a guard you can't justify in writing.**

Likely candidates (verified at execution time):

- `hybridAnalyze.ts` lines 143 + 148: `if (!pv || !rv) continue;`
  and `if (!rule || !para) continue;`. Both are inside loops
  iterating de-duped index maps that contain exactly the keys
  we just inserted. The lookups can't return undefined; the
  guards are TypeScript-narrowing artifacts.
- `cosine` helper's `?? 0` defaults inside the for-loop —
  same artifact, the index is always in bounds since the loop
  bound is `Math.min(a.length, b.length)`.

If post-cleanup actual ≥ 89.5%, bump threshold. If still short,
SKIP and document.

**Files:**

- `app/src/rules/hybridAnalyze.ts` — surgical guard removals (≤
  4-6 lines deleted per file).
- `app/vite.config.ts` — `branches: 88` → `branches: 89` IFF
  buffer met.
- `docs/TESTING.md` — refresh actuals + threshold paragraph.

**Tests / verify:**

- All existing tests pass unchanged. Part C does NOT add tests;
  the existing suite must continue to cover the post-cleanup
  code (the guards weren't covered to begin with — that's the
  point).
- `npm run test:coverage` shows branches ≥ 89.5%.
- Threshold floor in `vite.config.ts` matches.
- Static analysis: each removed guard has a one-line rationale
  in the commit body that holds up to inspection.

**Out of scope:** removing guards that ARE reachable but only
via paths the existing tests don't cover (those are real test
gaps, not unreachable code — write the test instead, in a
future part); refactoring beyond surgical removals; pushing for
branches ≥ 90 (Wave 25+).

## Merge order

A is the precondition for B (B's badge needs hybrid findings to
render in tests; the easiest way to get them is via Part A's
upload path, though Part B can also use a synthetic hybrid
finding fixture without depending on the upload-path change).

C is parallel-safe with A and B (touches different files).
Suggested:

```
A    (upload-path classifier pass)
   ↓
B    (UI badge — uses synthetic Finding fixture)
   ↓
C    (defensive-guard cleanup; bump or SKIP)
```

If A and B's hybrid-finding fixtures conflict (both want a
factory in `hybridAnalyze.test.ts` or somewhere shared), B's PR
description names the helper to coordinate. Most likely no
conflict: B uses an inline `Finding`-shaped object literal in
its RTL test.

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has
judgment calls — the `runClassifierPass` API surface in A, the
visible glyph + `aria-label` shape in B, which guards are
genuinely unreachable in C. Subagent dispatch overhead exceeds
the parallelism gain.

## Done definition

- Part A merged: `runClassifierPass` exists; upload path runs
  it after the worker returns; tests pin both flag-on (extras
  appended) and flag-on-load-fails (deterministic-unchanged).
- Part B merged: hybrid findings render a badge with the
  similarity percentage in the `aria-label`; deterministic
  findings render unchanged; a11y gate green; FindingsPanel
  tests pass.
- Part C either merged with branches floor 89 (actual ≥ 89.5%)
  OR SKIPPED with the actual recorded and the cleanup commit
  note explaining why post-cleanup didn't clear the buffer.
- All thresholds held; no behavior changes outside the new
  upload-path classifier pass and the new badge.
- No new IDB store, no new audit `kind`, no new dep, no new
  product UI panel (the badge is a span inside an existing
  panel).

## Hard caps summary

| Part | Cap |
|------|-----|
| A | 2 src edits + 2 test extensions; no new files; worker source untouched; flag-off behavior byte-identical |
| B | 1 src edit + 1 test extension + 1 CLAUDE.md line; no new files; no new ARIA roles; no i18n |
| C | ≤ 5 src files with surgical guard removals; 0 new files; 0 new tests; threshold bump only if branches ≥ 89.5% |

If a cap is breached, ship what fits and roll the overflow to
Wave 25. Do not negotiate caps up from inside a part.

## Wave 25 preview (out of scope here, queued)

- **Playwright e2e** that loads the real MiniLM-L3 in headless
  Chrome, asserts a paraphrased-clause golden case fires a
  hybrid finding with `evidence.modelId === 'Xenova/paraphrase-MiniLM-L3-v2'`,
  and verifies no CSP violations in the console.
- **Worker-path classifier wiring** if Wave 24-A's main-thread
  approach turns out to block the UI on large leases. (Likely
  not — the classifier runs on at most 50 paragraphs per lease;
  embedding latency at MiniLM scale is sub-second.)
- **Click-to-explain affordance** on the hybrid badge —
  expandable details panel showing the `Finding.evidence`
  payload alongside the audit-log entry.
- **Branches ≥ 90 push** if Wave 24-C cleared the 89.5% buffer
  and the actual sits at 89.7-89.9%; otherwise leave the floor
  at whatever Wave 24-C set.
