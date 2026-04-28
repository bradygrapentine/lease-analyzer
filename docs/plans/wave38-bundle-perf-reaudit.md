# Wave 38 — Bundle / perf re-audit Implementation Plan

> **Pairing:** Runs in parallel with **Wave 42 (Tauri decision)** — disjoint file ownership (W38 owns `app/vite.config.ts`, `app/src/**`, asset pipeline scripts; W42 owns `.github/workflows/tauri.yml`, `app-tauri/` stub, docs).

**Goal:** Re-measure the bundle + first-paint envelope; ship at most one
load-time win and one bundle-shrink win. No new features. No new deps.

**Architecture.** Pure measurement → targeted edit. Use `npm run check:budget`
+ `npm run build` `dist/` analysis + Lighthouse run. Compare against the
Wave 27/28 baseline numbers in `docs/BACKLOG.md` "Current footprint":
app shell ~290 KiB, pdf.js api 400 KiB, pdf.worker 1.3 MiB, leaseWorker
~8 KiB, tesseract opt-in 8 MiB. The post-Wave-36 v4 transformer landing
is the most likely shifter — verify it didn't bloat the shell.

**Tech Stack.** Vite 5, vite-plugin-pwa, `vite-bundle-visualizer` (or
`rollup-plugin-visualizer` if already in devDeps), Lighthouse CI.

**Base SHA.** `origin/main` at start of session. Read-only until §5.

## §1 Hard rules

1. **Measure before editing.** No code change until §4 has named the
   regression / opportunity with numbers.
2. **At most two file-touching changes ship.** One load-time fix +
   one bundle-shrink fix. If neither is justified by the measurement,
   ship the report alone (acceptable outcome).
3. **No new runtime deps.** Dev-only measurement deps are fine and must
   be removed before PR if not kept.
4. **No bundle-budget threshold tightening in this wave.** A separate
   wave can ratchet `app/scripts/check-budget.mjs` once the new floor
   is stable across two PRs.

## §2 Out of scope

- Migrating off pdf.js (it's the floor of the bundle and there's no
  drop-in replacement).
- Code-splitting the rule pack v1 (already small, splitting adds startup
  fetch cost).
- Service-worker precache strategy changes.

## §3 Execution

Direct, single-track. Estimated 1-3 hours.

## §4 Investigation steps

- [ ] **Baseline.** Run `npm run build && npm run check:budget`. Record
  per-chunk sizes from `dist/assets/*.js` `du -k`.
- [ ] **Compare to W27/28 footprint** in `docs/BACKLOG.md`. Note any
  chunk that grew >10%.
- [ ] **Lighthouse.** `npm run lhci`. Record LCP, TBT, CLS, total blocking
  time. Compare to last-known scores in CI artifacts.
- [ ] **Visualize.** Add `rollup-plugin-visualizer` to devDeps (TEMP),
  rebuild, open the treemap. Capture a screenshot and the top-10 module
  sizes for the report. Remove the dep before PR if no follow-up uses it.
- [ ] **Identify candidates.** From the treemap, list every module
  ≥30 KiB that's loaded on first paint. Mark which are lazy-loadable
  (panel components, redline pane, audit pane, etc.).
- [ ] **Pick at most one load-time win** (e.g. lazy-load a panel that
  isn't above-the-fold) and **at most one shrink win** (e.g. swap a
  module for a lighter alternative, dedupe a transitive). Both must
  be backed by a number from §4.

## §5 File changes

Likely targets (pick at most two — touch ≤3 files including tests):

- `app/src/App/AppLibraryAndPacksPane.tsx` or similar — add `lazy()` +
  `<Suspense>` boundary if the pane isn't above-the-fold.
- `app/vite.config.ts` — `manualChunks` tweak only if the treemap shows
  a clear miss (e.g. a vendor lib loaded twice).
- A test that asserts the lazy boundary still renders (RTL with the
  pane mounted under a `<Suspense>` fallback).

If the measurement shows nothing actionable, **ship the report only**
(see §7). That's a successful outcome.

## §6 Verification

- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] `npm run build` succeeds.
- [ ] `npm run check:budget` passes (no threshold tightening — same gate
  as before).
- [ ] `npm run lhci` passes existing thresholds.
- [ ] Manual `npm run dev` smoke walk: upload sample PDF → analyze →
  open redline pane → confirm no perceptible delay vs main.
- [ ] If a panel was lazy-loaded, RTL test covering the Suspense boundary
  is green.

## §7 PR

- Title: `wave38: bundle/perf re-audit (+ <fix> | report-only)`
- Body sections:
  - **Baseline numbers.** Per-chunk sizes + Lighthouse scores.
  - **Treemap finding.** Top-10 modules; what changed since W27/28.
  - **Fix(es) shipped.** Each with before/after numbers, OR
  - **No fix shipped — measurement is within tolerance.** Acceptable.
  - **Follow-ups.** Anything worth a future wave (don't pile in here).

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| Lazy-loading a panel introduces a flash-of-fallback that hurts UX. | Test in `npm run dev` and confirm Suspense fallback is invisible (panel below the fold or behind a click). |
| Bundle visualizer dep accidentally lands in deps. | Pre-PR check: `grep visualizer app/package.json` → must be empty (or in devDependencies and intentional). |
| Numbers move between local and CI. | Record both. Use CI numbers for the PR body. |
