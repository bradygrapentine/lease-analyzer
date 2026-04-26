# Wave 21 — Phase 18 hybrid `analyze()` + App.tsx finish push

**Goal:** put Wave 20-C's `loadClassifier()` infrastructure to work
behind a feature flag (Phase 18's hybrid rules + on-device LLM
becomes a real, testable code path); finish the App.tsx
decomposition push that's been deferred since Wave 17 by extracting
the bottom-pane panel stack; and try once more to land the
contingent branch-threshold bump that Waves 18-20 all skipped.

## Scope boundary

Wave 21 owns:

- `app/src/rules/hybridAnalyze.ts` (NEW, Part A) — wraps the
  deterministic rules engine with an optional classifier pass.
- `app/src/rules/hybridAnalyze.test.ts` (NEW, Part A).
- `app/src/llm/featureFlag.ts` (NEW, Part A) — Phase 18 feature-flag
  read (URL param + localStorage; off by default).
- `app/src/llm/featureFlag.test.ts` (NEW, Part A).
- `app/src/App/usePipeline.ts` (Part A only — single edit point to
  thread the flag + classifier through to `analyze()`).
- `app/src/App.tsx` (Part B only — single writer for the wave's
  decomposition).
- `app/src/ui/AppLibraryAndPacksPane.tsx` (NEW, Part B) — sub-component
  for the bottom-pane panel stack.
- `app/src/ui/AppLibraryAndPacksPane.test.tsx` (NEW, Part B).
- `app/vite.config.ts` (Part C only — branch threshold 88→89).
- `docs/TESTING.md` (Part C only — actuals refresh).

Wave 21 does **NOT** touch:

- IndexedDB schema; no new audit `kind` strings (`evidence`-attestation
  for LLM findings rolls to Wave 22 once the real model integration
  has shaken out).
- The Tesseract OCR pipeline.
- Any actual model precaching into the service worker (Wave 22+ —
  needs Workbox config surgery + the CSP audit). Wave 21's Part A
  uses a **mockable EmbedFunction injection seam**; production code
  doesn't fetch the real model yet.
- Paraphrased-clause golden test against the real model (Wave 22 —
  needs Node-side onnxruntime infra to run reliably in CI).
- CSP impact audit (Wave 22 — empirical once Workbox precaches the
  model files).
- New product UI (no banner, no toggle in the app — Phase 18 stays
  developer-only behind a URL-flag in Wave 21).

## Pre-flight

1. Wave 20 (A/B/C + plan) merged. Wave 21 starts from `main` at or
   after Wave 20-C's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green; combined OCR + classifier
   lane reports its trivial value.
3. Verify `app/src/App.tsx` is still **639 lines** (no separate
   commits shrunk it). Recompute Part B's target if so.
4. Verify branches actual is still **89.39%**. Part C is contingent
   on its post-A+B actual ≥ 89.5%.
5. Read each part's cap before starting. Caps are contracts.

## Parts (A and B parallel-safe; C depends on A+B)

### Part A — hybrid `analyze()` with feature flag

**Branch:** `wave21-hybrid-analyze`

**Cap:** **≤ 3 new src files** (`hybridAnalyze.ts`, `featureFlag.ts`,
+1 if a small helper splits out cleanly) and **≤ 2 new test files**.
**1 edit** to `usePipeline.ts` to thread the flag + a mockable
classifier through to the analyze step. **No new audit `kind`
strings**, **no UI changes**, **no production caller** of the real
model — Wave 21 ships the seam + the deterministic-fallback contract,
not the integrated path.

**Approach:**

The deterministic rules engine (`app/src/rules/analyze.ts`) is the
authority. The classifier runs as an **optional second pass** on
paragraphs the deterministic engine flagged with **low confidence**
or didn't flag at all. The hybrid path adds findings; it never
removes or overrides them.

Module layout:

- `app/src/llm/featureFlag.ts` — exposes
  `isPhase18Enabled(): boolean`. Returns true iff URL has
  `?phase18=on` OR `localStorage.getItem('leaseguard.phase18')` is
  the literal string `'on'`. Default off; the read is pure (no side
  effects). A `setPhase18Override(value: 'on' | 'off' | null)`
  helper for tests + dev console.
- `app/src/rules/hybridAnalyze.ts` — exports `runHybridAnalyze({
  doc, rules, embedFn, threshold, maxLlmCalls })`. Always runs
  `analyze(doc, rules)` first. If `embedFn` is null OR the flag is
  off, returns those findings unchanged. Otherwise: for each
  paragraph with zero findings AND at least one keyword overlap
  with a rule, embed the paragraph and the rule's title (cached
  per-rule), compute cosine similarity, emit a finding with
  `confidence = 0.5` and `negated: false` if similarity ≥ threshold.
  `maxLlmCalls` caps the embedding budget per lease (default 50)
  so a worst-case parse doesn't fan out unboundedly.
- `app/src/App/usePipeline.ts` — read `isPhase18Enabled()`; when
  true and the worker fallback is used (jsdom / inline mode), call
  `runHybridAnalyze` with `loadClassifier`-derived `embedFn`
  instead of `analyze()`. Worker mode (production) keeps using the
  deterministic path until Wave 22 wires the model into the worker
  bundle separately.

**Files:**

- `app/src/llm/featureFlag.ts` (NEW) — pure flag-reader.
- `app/src/llm/featureFlag.test.ts` (NEW) — pins the read precedence
  (URL param > localStorage > default-off).
- `app/src/rules/hybridAnalyze.ts` (NEW) — the wrapper.
- `app/src/rules/hybridAnalyze.test.ts` (NEW) — exercises the
  full contract with a **stub** embedder that returns deterministic
  synthetic vectors:
  - Flag off → same output as `analyze()`.
  - Flag on + `embedFn` null → same output as `analyze()`.
  - Flag on + stub embedder → adds findings for paragraphs with
    keyword overlap and high cosine similarity.
  - Flag on + stub embedder → low similarity → no extra findings.
  - `maxLlmCalls` cap is honored (zero embeddings called past the
    cap).
  - The classifier never **removes** a deterministic finding.
- `app/src/App/usePipeline.ts` — single edit point: read the flag,
  pick `runHybridAnalyze` vs `analyze`. Production worker path
  unchanged.

**Tests / verify:**

- `npm run test:coverage` thresholds hold.
- `App.test.tsx` and `App.panels.test.tsx` pass unchanged (flag
  defaults off; no behavior change at the React layer).
- New tests don't import `@xenova/transformers` directly — only
  through the stub `EmbedFunction`. Real-model integration tests
  roll to Wave 22 with the precache + CI infra.

**Out of scope:** UI surface for the flag (no toggle, no banner —
URL-flag only); precaching the model files into Workbox (Wave 22);
new audit `kind: 'llm-classify'` (Wave 22 — needs the integration
to settle first); the paraphrased-clause golden test against the
real model; CSP audit.

### Part B — `<AppLibraryAndPacksPane>` extraction

**Branch:** `wave21-app-library-pane`

**Cap:** App.tsx **≤ 480 lines** (from 639; that's a 25% cut, ~159
lines extracted). **≤ 2 new files** (sub-component + its test).
**Zero behavior changes.** Coverage thresholds NOT bumped here.

**Approach:**

The bottom-pane panel stack runs from roughly App.tsx line 443 to
line 625 — `<LibraryPanel>` + `<LibraryCompareForm>` +
`<TemplatesPanel>` + `<PackManagerPanel>` (with the inline
marketplace `loadManifest` / `onInstall` / `onPreviewDiff`
callbacks) + `<details>` custom rule builder + `<JurisdictionPickerPanel>`
+ `<SeverityOverridesPanel>` + diff-rule-pack `<section>` +
`<BulkImportPanel>` + `<AuditLogPanel>` + `<SigningKeyPanel>` +
optional `<ComparePanel>`. ~180 lines of JSX. This is the last big
chunk left in App.tsx.

The marketplace inline callbacks (~70 lines: fetch, verify, JSON
parse, signature check, diff) are the trickiest to relocate
cleanly. Two options:

- (a) Pass them as props to `<AppLibraryAndPacksPane>` (fat prop
  interface, ~28 props total — wider than `<AppCurrentPane>` but
  already mechanical to thread).
- (b) Lift them into `usePackManager` first as a separate
  `useMarketplaceCallbacks` hook (smaller prop count downstream,
  more refactoring up front).

Pick (a) at execution time unless the prop count climbs past 30 —
then stop, ship a smaller extraction (e.g. just the bottom row:
`<BulkImportPanel>` + `<AuditLogPanel>` + `<SigningKeyPanel>` + the
optional `<ComparePanel>`), and roll the marketplace lift to Wave
22+.

**Files:**

- `app/src/App.tsx` — JSX + import edits.
- `app/src/ui/AppLibraryAndPacksPane.tsx` (NEW) — the sub-component.
- `app/src/ui/AppLibraryAndPacksPane.test.tsx` (NEW) — RTL smoke
  test: each panel mounts; one callback wiring (e.g. clicking a
  library row's "open" button fires `onOpen`).

**Tests / verify:**

- App.tsx ≤ 480.
- `App.test.tsx` and `App.panels.test.tsx` pass unchanged. Public
  selectors (aria-labels, role names) stay stable.
- Bundle budget unchanged; coverage thresholds hold.

**Out of scope:** further lift of the marketplace callbacks into a
hook (Wave 22 candidate if (a) keeps the prop count over 24);
splitting `<AppLibraryAndPacksPane>` into smaller children
internally (sub-component-of-sub-component); behavior changes
during decomposition.

### Part C — branch threshold bump 88 → 89

**Branch:** `wave21-coverage-threshold`

**Cap:** **1 src file edit** (`app/vite.config.ts`) + **1 doc edit**
(`docs/TESTING.md`). **No new tests.** **Contingent on post-A+B
actual ≥ 89.5%** — same buffer rule that skipped Waves 18-C, 19-B,
and 20-A.

**Approach:**

Branch coverage trajectory across A/B is the open question. Part
A's classifier path adds new branches but with comprehensive stub
tests; Part B's sub-component extraction adds branches but they're
mostly mechanical render-time `&&`s. Net effect: probably +0.3% to
+0.7%. From 89.39% post-Wave-20 that lands the actual at
89.7-90.1%, finally clearing the 89.5% buffer for the +1 floor
bump.

If post-A+B actual < 89.5%: SKIP, document the actual, the bump
rolls to Wave 22+. Don't cherry-pick branch-coverage-only tests
into this part — that's a Wave 16-A pattern, not a contingent
floor bump.

**Files:**

- `app/vite.config.ts` — `branches: 88` → `branches: 89`.
- `docs/TESTING.md` — refresh threshold paragraph + actuals table.

**Tests / verify:**

- `npm run test:coverage` passes with the new floor (CI gate stays
  green).
- The actual is ≥ 89.5% (the buffer rule).
- No new tests added; coverage gain is a side effect of A+B's tests.

**Out of scope:** statements / functions / lines floor bumps; pushing
for branches ≥ 90 (Wave 22+); writing tests purely to inflate
numbers.

## Merge order

A and B touch disjoint files (A: `rules/`, `llm/`, `App/usePipeline.ts`;
B: `App.tsx`, `ui/`). C reads A+B's combined coverage, so it must
land last. Suggested:

```
A, B  (parallel-safe; disjoint files)
   ↓
C    (lands last; SKIPS if branches < 89.5%)
```

If A and B run in serial, any order works. If parallelized, no
merge conflicts expected.

## TDD recommendation

**Direct (single Opus author) for all three.** Part A has product
judgment calls (similarity threshold, max-LLM-calls cap, what
counts as "low keyword overlap") that benefit from context. Part
B has the prop-interface judgment call. Part C is too small to
dispatch.

## Done definition

- Part A merged: `runHybridAnalyze` exists; `isPhase18Enabled()`
  defaults off; `usePipeline` threads the flag through; tests pin
  the deterministic-equivalence contract when off and the
  additive-only contract when on.
- Part B merged: App.tsx ≤ 480 lines; `<AppLibraryAndPacksPane>`
  + test exist; behavior unchanged.
- Part C either merged with branches floor 89 (actual ≥ 89.5%) OR
  SKIPPED with the actual recorded.
- All thresholds held; no behavior changes to the deterministic
  analyze pipeline; no new product UI; no model precached; no new
  audit `kind`; no new dep beyond what Wave 20-C pinned.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | ≤ 3 new src files; ≤ 2 new test files; 1 edit to `usePipeline.ts`; no UI changes; no production model fetch; no new audit kind |
| B | App.tsx ≤ 480; ≤ 2 new files (sub-component + test); 0 behavior changes; coverage NOT bumped here |
| C | 1 src + 1 doc edit; SKIPS if branches < 89.5% post-A+B |

If a cap is breached, ship what fits and roll the overflow to
Wave 22 explicitly. Do not negotiate caps up from inside a part.
