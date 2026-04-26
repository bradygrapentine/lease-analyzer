# Wave 17 — App.tsx decomposition + PWA / measurement closeouts

**Goal:** make material progress on the App.tsx-decomposition rock
that blocked Wave 16-A's branch-coverage push, fix the long-standing
Lighthouse CI red, refresh the BACKLOG facts that drift each wave,
and run a Phase 18 feasibility measurement so the next wave starts
with real numbers instead of guesses. Four parts; tight caps so the
wave ships in one session, not a refactor without a floor.

## Scope boundary

Wave 17 owns:

- `app/src/App.tsx` (Part A only — single writer), `app/src/App/*.ts`
  for any new hook extractions (Part A).
- `app/src/ui/AppHeader.tsx` (NEW, Part A), `app/src/ui/AppHeader.test.tsx`
  (NEW, Part A) — and any other sub-component file pair Part A
  introduces. Each new file pair counts against Part A's cap.
- `app/src/App.test.tsx` and `app/src/App.panels.test.tsx` (Part A
  only) for assertion adjustments around the extracted JSX surface.
- `app/public/manifest.webmanifest` (Part B), `app/index.html` (Part
  B for icon link tags), `app/public/icons/*` (Part B if a new
  apple-touch-icon needs adding), `app/lighthouserc.json` (Part B
  only if a budget needs documenting).
- `docs/BACKLOG.md` (Part C — single writer), `docs/ROADMAP.md` (Part
  C only).
- `app/scripts/measure-llm-budget.mjs` (NEW, Part D), no
  production-source changes.

Wave 17 does **NOT** touch:

- IndexedDB schema (no version bump).
- Rules engine, parser, redline, signing, audit code (Part A's
  decomposition is JSX/orchestration only — no behavior changes).
- Coverage thresholds (Part A intentionally does not bump them; the
  branch-coverage push lands as Wave 18 once the App.tsx surface is
  smaller).
- New product UI; no new audit `kind` strings.
- Storybook moderate-vuln tree (rolls to a future maintenance wave —
  Storybook major bump is out of scope here).

## Pre-flight

1. Wave 16 (A/B/C/D/E/F + plan PR) all merged. Wave 17 starts from
   `main` at or after `b24c6d4`.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green. `npm run check:csp` green.
3. Verify `app/src/App.tsx` is still ~1007 lines. If a separate
   commit has already shrunk it, recompute Part A's target.
4. Confirm `gh run list --workflow lighthouse --limit 1` is still
   failing on the same `apple-touch-icon` + `installable-manifest`
   audits Part B targets. If the failure mode has changed, re-scope
   Part B before dispatch.
5. Read the per-part **cap** before starting that part. The cap is
   the contract. If hit before the work feels "done," ship what's
   in scope and roll the rest into Wave 18. Do not negotiate the
   cap up from inside the part.

## Parts (parallel-safe; merge order at the bottom)

### Part A — App.tsx render-surface decomposition

**Branch:** `wave17-app-decomp`

**Cap:** App.tsx **≤ 850 lines** (from 1007; that's a 15% cut, not
the BACKLOG row's full ≤600 target — the rest rolls to Wave 18).
**≤ 2 new sub-component files** (each with its own `.test.tsx`).
**Zero behavior changes** — every existing test in `App.test.tsx` and
`App.panels.test.tsx` passes unchanged. Coverage thresholds are NOT
bumped in this part.

**Approach:**

10 hooks have already been extracted from App.tsx (`use*.ts` siblings
under `app/src/App/`). The remaining bulk is JSX render +
imperative orchestration, not extractable hook bodies. Two
candidates Part A picks from (whichever shaves more lines for less
risk):

- `<AppHeader>` — title, view-toggle buttons (current / portfolio /
  redline), sample-lease button, upload control. Today these mount
  inline at the top of App's render. Pure presentational; takes
  callbacks from App. Estimated 80-150 line reduction.
- `<AppLibraryPane>` — "My Leases" + bulk-import + clear-all controls.
  Today these mount inline below the findings panel. Same shape:
  pure presentational, callbacks. Estimated 60-120 line reduction.

Pick **at most 2**. If one alone clears the 850-line cap with
headroom, ship just one and roll the other to Wave 18.

**Files:**

- `app/src/App.tsx` — JSX edits to mount the new sub-components +
  pass props.
- `app/src/ui/AppHeader.tsx` (NEW) — presentational, no IDB / audit
  imports. Props are plain data + callback functions.
- `app/src/ui/AppHeader.test.tsx` (NEW) — RTL smoke test: renders
  with each view-mode prop, callbacks fire on click.
- `app/src/ui/AppLibraryPane.tsx` (NEW, optional per cap) — same
  shape as AppHeader.
- `app/src/ui/AppLibraryPane.test.tsx` (NEW, optional).

**Tests / verify:**

- `git diff main..HEAD -- app/src/App.tsx | grep '^-' | wc -l` shows
  the line drop is real (not just moved into sibling files that App
  re-imports verbatim).
- All existing `App.test.tsx` and `App.panels.test.tsx` cases pass
  unchanged. If a test is brittle to the new component boundary, it's
  the test's problem — fix the test, not the boundary.
- `npm run test:coverage` thresholds hold. New sub-components must
  not drop branch coverage below 88.31% (Wave 16-A's actual).
- Bundle budget unchanged (sub-components are pure ESM; no new
  runtime cost).

**Out of scope:** any extraction past 2 sub-components (Wave 18 takes
the rest); reaching the BACKLOG row's ≤600-line target (rolls to
Wave 18 by design); behavior changes during decomposition (every
extracted callback must do exactly what it did inline).

### Part B — Lighthouse CI green

**Branch:** `wave17-lighthouse-fix`

**Cap:** **≤ 3 file edits** (manifest + index.html + maybe
`lighthouserc.json`). **≤ 1 new icon file** committed. No JS source
changes.

**Approach:**

Lighthouse CI is failing on two audits per the Wave 16 PR runs:

1. `apple-touch-icon` — no `<link rel="apple-touch-icon">` in
   `app/index.html`. Fix: add the link tag and ship a 180x180 PNG
   under `app/public/icons/apple-touch-icon-180.png` (or reuse the
   existing SVG icon rasterized once).
2. `installable-manifest` — `app/public/manifest.webmanifest` is
   probably missing a required field (`icons[].purpose: any`,
   `start_url`, `display`, or similar). Read the actual lighthouse
   audit JSON from a recent run, identify the failing field, fill it.

**Files:**

- `app/index.html` — add `<link rel="apple-touch-icon" sizes="180x180"
  href="/icons/apple-touch-icon-180.png">`.
- `app/public/manifest.webmanifest` — add whatever field the
  installable-manifest audit names.
- `app/public/icons/apple-touch-icon-180.png` (NEW) — committed
  binary is OK here per the PWA convention; this is an icon, not a
  test fixture, and CLAUDE.md's no-binary-fixtures rule is about
  test fixtures.
- `app/lighthouserc.json` — only if a budget needs documenting.

**Tests / verify:**

- `npm run lhci` (or whatever the local invocation is) green.
- `gh run view <new-run-id>` shows `auditRan` passes for both
  `apple-touch-icon` and `installable-manifest`.
- Other Lighthouse audits don't regress (a11y >= 95,
  best-practices >= 90).

**Out of scope:** improving Lighthouse scores beyond passing the
existing thresholds; adding new performance budgets;
service-worker behavioral changes.

### Part C — BACKLOG / ROADMAP fact refresh

**Branch:** `wave17-backlog-refresh`

**Cap:** **≤ 8 doc edits** total across `docs/BACKLOG.md` and
`docs/ROADMAP.md`. **No new rows.** **No flips that claim shipped
when not shipped.** Edits are stale-text fixes only — line counts,
test counts, coverage actuals, hook names that have moved.

**Targets (verified with grep before edit):**

- BACKLOG line ~24 "Tests" current footprint: `~960 passing` is stale
  (actual ~1117 post-Wave 16-A). Update.
- BACKLOG line ~21 "Coverage" current footprint: `thresholds 90/85/90/90`
  is stale (actual `95/88/91/95`). Update.
- BACKLOG line ~24 "App.tsx" current footprint row: still says
  "decomposed into per-panel containers around `usePipeline` (Wave
  7-D)" — confirm still accurate (no edit needed) or update to
  reflect Wave 17 Part A if A landed first.
- BACKLOG line ~530 "App.tsx decomposition" `[ ]` row: text says
  "currently ~1540 lines (was ~835 at the last footprint refresh)" —
  actual is 1007 (or whatever Part A leaves it at). Update the
  number; do not flip the checkbox unless the row's ≤600 target is
  hit.
- BACKLOG line ~536 panels-test timeout row: re-check the claim
  against current `App.panels.test.tsx` (Wave 16-A bumped a related
  timeout). If the original failure mode is gone, flip to `[x]` with
  a one-line note pointing at Wave 16-A. If still flaky, leave `[ ]`
  and add a one-line "still flaky as of YYYY-MM-DD."
- ROADMAP "Tech debt" section line ~93: "Decompose `App.tsx` (~1540
  lines)" — same number stale; update.
- ROADMAP "Tech debt" line ~95: "Fix reanalyze-staleness" — already
  shipped Wave 7-D. Either remove the bullet or re-frame as
  follow-up cleanup.

**Tests / verify:**

- `git diff main..HEAD --stat` shows only `docs/BACKLOG.md` and
  `docs/ROADMAP.md` modified.
- No `[x]` marks added to rows where Part C didn't ship the
  underlying work itself (single exception: the panels-test row if
  Part C verifies it's actually fixed).
- `prettier --check` clean on both files.

**Out of scope:** adding new rows (Wave 16-C used the row-add
budget); reorganizing phases; flipping rows whose work isn't
demonstrably shipped.

### Part D — Phase 18 feasibility measurement

**Branch:** `wave17-phase18-measure`

**Cap:** **1 new script** (`app/scripts/measure-llm-budget.mjs`).
**0 source-code changes.** **1 BACKLOG row trailer** added to the
existing Wave 16-C row "Model selection + bundle-size budget gate"
recording the measured numbers.

**Approach:**

Phase 18's first BACKLOG row says the precache-delta budget for the
LLM is "set by what we measure." Part D measures. No code lands; the
output is a paragraph of numbers in the BACKLOG row trailer + a
one-time-runnable script for future re-measurement.

The script:
- Downloads a candidate model (likely `Xenova/distilbert-base-uncased`
  or a smaller classification head — Part D's author picks one before
  starting and writes the choice into the script comment header).
- Reports the model's on-disk size, the tokenizer's size, and the
  estimated precache-delta vs. today's `precache 17 entries
  (11901.30 KiB)` baseline.
- Does **not** add the model to the actual bundle, the precache, or
  any source file. It's a measurement tool, not an integration step.

**Files:**

- `app/scripts/measure-llm-budget.mjs` (NEW) — Node script that
  downloads + measures + prints. Documented as one-time / on-demand;
  not added to any npm script that runs as part of CI.
- `docs/BACKLOG.md` — append a one-paragraph trailer to the existing
  "Model selection + bundle-size budget gate" row recording the
  measured numbers and the model choice (Part C is the BACKLOG
  single-writer for unrelated edits; Part D's edit is surgical to
  one row that Part C has been told to leave alone for this trailer
  — coordinate via PR comment if both are in flight).

**Tests / verify:**

- `node app/scripts/measure-llm-budget.mjs` runs to completion on a
  fresh `npm install` machine and prints the numbers.
- The numbers landed in BACKLOG match the script's most recent
  output.
- No production-source change (`git diff main..HEAD -- 'app/src/**'`
  is empty).

**Out of scope:** integrating the model into `analyze()`; bundling
the model into the precache; CSP audit (rolls to its own follow-up
once the integration ships); model-license review (also a separate
follow-up — same as the Tesseract review precedent).

## Merge order

A, B, D are independent (App.tsx vs PWA manifest vs scripts dir —
disjoint subtrees). C is the doc-reconciliation pass and can run in
any order **except** that it should re-check Part A's actual
post-decomposition line count before landing. Suggested:

```
A, B, D  (parallel-safe; disjoint files; A can ship last so its
          line-count update lands cleanly in Part C)
   ↓
C       (lands last so it can absorb Part A's actual final line
         count + any Part D measurement-row trailer)
```

If C lands first, A's PR can update the BACKLOG line-count entry
inline (Part A is allowed to touch its own row's line-count number;
that's a fact-fix, not a row flip).

## TDD recommendation

**Direct (single Opus author) for A and C.** Both have judgment
calls — which sub-components to extract (A), which BACKLOG rows are
genuinely stale vs. legitimately partial (C). A subagent without
product context will guess.

**Direct dispatch (parallel subagents) for B and D.** B is narrow
(read failing audit, fix manifest field) and D is narrow
(download → measure → print). Both are mechanically verifiable.

No TDD escalation needed; the Wave 16 friction modes (cap-not-met,
plan-vs-reality drift) don't apply here — A's cap is conservative
by design, and the other parts have crisp success criteria.

## Done definition

- All four PRs merged.
- `app/src/App.tsx` ≤ 850 lines (Part A); ≥ 2 new tests for
  extracted sub-components, all green.
- Lighthouse CI green on the post-merge run; `apple-touch-icon` and
  `installable-manifest` audits both pass.
- BACKLOG / ROADMAP "current footprint" + tech-debt numbers reflect
  reality as of merge date.
- `app/scripts/measure-llm-budget.mjs` exists and runs; the
  measured numbers are recorded in the corresponding BACKLOG row's
  trailer.
- No new IDB store; no new audit `kind`; no new product surface; no
  coverage threshold bumps; no new top-level dep.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | App.tsx ≤ 850 lines; ≤ 2 new sub-component files; 0 behavior changes; coverage thresholds NOT bumped |
| B | ≤ 3 file edits; ≤ 1 new icon file; both failing audits pass |
| C | ≤ 8 doc edits; 0 new rows; 0 false-progress flips |
| D | 1 new script; 0 source-code changes; 1 BACKLOG row trailer |

If a cap is breached, ship what fits and roll the overflow to Wave
18 explicitly. Do not negotiate caps up from inside a part.
