# Wave 20 — Coverage push + `<AppCurrentPane>` + Phase 18 first slice

**Goal:** three independent themes that have all been deferred for
multiple waves, sized as one coherent housekeeping wave. Get branch
coverage past the 89.5% buffer (so the 88→89 threshold can finally
bump), finish the App.tsx decomposition push by extracting
`<AppCurrentPane>`, and lay the **infrastructure** for Phase 18 (dep
pin + precache-budget gate + lazy-loader stub) without shipping the
hybrid `analyze()` path itself. Three parts; tight caps.

## Scope boundary

Wave 20 owns:

- New test files under `app/src/**/*.test.ts(x)` (Part A only;
  ≤ 6 new test files / ≤ 30 new test cases combined).
- `app/vite.config.ts` (Part A only — branch threshold 88→89, after
  Part A's actual ≥ 89.5%).
- `docs/TESTING.md` (Part A only — actuals refresh).
- `app/src/App.tsx` (Part B only — single writer for the wave's
  decomposition).
- `app/src/App/useCurrentViewState.ts` (NEW, Part B) — derived state
  + state-mutating callbacks for the `view === 'current'` block.
- `app/src/ui/AppCurrentPane.tsx` (NEW, Part B) — sub-component
  rendering the FindingsPanel + PdfViewer + selected-finding article
  + workflow / counter / template panels for the analyzed view.
- `app/package.json` (Part C only — pin `@xenova/transformers` as a
  dependency).
- `app/scripts/check-bundle-budget.mjs` (Part C only — extend with
  precache-delta cap).
- `app/src/llm/loadClassifier.ts` (NEW, Part C) — lazy-loader stub.
  No production caller; covered by its own unit test.
- `app/scripts/check-bundle-budget.config.json` or similar (Part C
  only if the budget script externalizes its caps; otherwise Part C
  edits the `.mjs` directly).

Wave 20 does **NOT** touch:

- IndexedDB schema, audit `kind` strings.
- The hybrid `analyze()` path (Part C is **infrastructure only** —
  the real classifier integration is Wave 21).
- New product UI; no new buttons; no new audit kinds.
- Phase 18 model files in `app/public/` (Part C does NOT precache a
  real model; the budget gate sets the contract for when it does).
- Storybook major bump (still on the maintenance shelf).

## Pre-flight

1. Wave 19 (A + plan; B SKIPPED) merged. Wave 20 starts from `main`
   at or after Wave 19-A's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green.
3. Verify `app/src/App.tsx` is still **771 lines**. If shrunk by a
   separate commit, recompute Part B's target.
4. Verify branches actual is still **88.62%**. If it's already
   ≥ 89.5% from a sibling commit, Part A's threshold bump
   simplifies (don't add tests purely to inflate it).
5. Read each part's cap before starting. Caps are contracts.

## Parts (A, B, C parallel-safe by file ownership)

### Part A — coverage push to ≥ 89.5% + threshold bump 88 → 89

**Branch:** `wave20-coverage-push`

**Cap:** **≤ 6 new test files** with **≤ 30 new test cases combined**.
**Zero production-source edits.** Threshold bump is conditional on
post-A actual ≥ 89.5% (the same buffer rule that skipped Waves
18-C and 19-B). If after the new tests land branches still < 89.5%,
**don't bump** — document the actual and roll the bump to Wave 21.

**Approach:**

The lowest-hanging branch-coverage gains as of Wave 19 close:

| file                          | missed branches | strategy                           |
|-------------------------------|-----------------|------------------------------------|
| `facts/rentSchedule.ts`       | 18              | edge-case input fixtures           |
| `ui/renderPdfPages.ts`        | 12              | abort/cancel paths via stubbed pdf.js |
| `parser/extractPages.ts`      | 8               | malformed-text-item via stub        |
| `compare/similarity.ts`       | 7               | mostly defensive `?? 0` — skip      |
| `App/useAppCallbacks.ts`      | 5               | error paths in onTrySample / onExportSignedJson |
| `App/useRedlineState.ts`      | 5               | likely no-op branches; cherry-pick  |
| `ui/OpenReviewPanel.tsx`      | 6               | RTL render + 404 / expired states   |

Pick **2-4 of these** for max leverage. `rentSchedule` (18) +
`useAppCallbacks` (5) + `useRedlineState` (5) alone covers ~28
branches if 80% land — enough to clear 89.5% from 88.62%
(needed: ~28 covered branches).

Skip files where the missed branches are `noUncheckedIndexedAccess`
defensive guards (`?? 0`, `?? ''`) — those are runtime-unreachable
and not worth chasing.

**Files:**

- New test files for the picked targets. Each test file follows the
  existing co-location convention (`foo.test.ts` next to `foo.ts`).
  Total ≤ 6 new files.
- `app/vite.config.ts` — `branches: 88` → `branches: 89` IFF post-A
  actual ≥ 89.5%.
- `docs/TESTING.md` — refresh the actuals paragraph + threshold
  table line.

**Tests / verify:**

- `npm run test:coverage` shows branches ≥ 89.5% (the buffer rule).
- Threshold floor in `vite.config.ts` matches the branch threshold
  bump (89 if buffer met, otherwise 88 unchanged).
- All new tests pass on first run; no new flakes under coverage
  instrumentation.

**Out of scope:** statements / functions / lines threshold bumps
(those have headroom but the plan target is branches only); pushing
for branches ≥ 90 (Wave 21+); writing tests for files with > 92%
branches (those are already in good shape).

### Part B — `<AppCurrentPane>` extraction with `useCurrentViewState`

**Branch:** `wave20-app-current-pane`

**Cap:** App.tsx **≤ 550 lines** (from 771; that's a 29% cut, ~220
lines extracted). **≤ 4 new files**: one hook + its test, one
sub-component + its test. **Zero behavior changes.** Coverage
thresholds NOT bumped here (Part A handles the threshold).

**Approach:**

The `view === 'current' && status.kind === 'analyzed'` block (~340
lines starting at App.tsx line 411) is the largest remaining JSX
chunk in App.tsx. It's been deferred for two waves because it
references ~12 state values + 8 callbacks. Wave 20-B unblocks it
the same way Wave 18-A unblocked `<AppRedlinePane>`: lift derived
state into a hook first, then the sub-component's prop interface
becomes manageable.

Step 1 — `useCurrentViewState` hook. Pulls in:
- `selected` / `setSelected` (selected finding state)
- `selectedPage` / `setSelectedPage`
- `ocrLanguage` / `setOcrLanguage` / `ocrLanguages`
- (any other view-local state lifted from App.tsx render body)

Returns a stable bundle the sub-component consumes.

Step 2 — `<AppCurrentPane>` sub-component. Wraps the analyzed-view
JSX. Props (target ≤ 12):
- `status` (analyzed) + the lease bytes
- `viewState` (the hook output bundle)
- `redline` / `packs` / `counters` / `signingKey` hook surfaces
- `templates` + `glossary` + the derived-state outputs
  (plainEnglishByRuleId, suggestedTextByRuleId, sectionForParagraph)
- 4-6 callbacks (`onExportJson`, `onBuildIcs`, `onCopySummary`,
  `downloadHandoffZip`, `onApplySuggestion`, `setView`)

If the prop count climbs past 12 mid-extraction, **stop**, ship
the hook + a smaller sub-component (e.g. just the FindingsPanel
wrapper), and roll the bigger split to Wave 21.

**Files:**

- `app/src/App.tsx` — JSX + import edits.
- `app/src/App/useCurrentViewState.ts` (NEW) — the hook.
- `app/src/App/useCurrentViewState.test.ts` (NEW) — `renderHook`
  cases pinning the state-mutation contract.
- `app/src/ui/AppCurrentPane.tsx` (NEW) — the sub-component.
- `app/src/ui/AppCurrentPane.test.tsx` (NEW) — RTL smoke test for
  the analyzed-view render + at least one callback wiring
  (e.g. clicking a finding fires `onSelect`).

**Tests / verify:**

- `git diff main..HEAD -- app/src/App.tsx | grep '^-' | wc -l`
  shows the line drop is real.
- Existing `App.test.tsx` and `App.panels.test.tsx` cases pass
  unchanged. Public selectors (aria-labels, role names) stay
  stable.
- Coverage thresholds hold (no drop below 95/88/91/95 on
  `vite.config.ts` — Part A's bump is conditional and lands in
  Part A's PR).

**Out of scope:** further App.tsx splits past `<AppCurrentPane>`
(rolls to Wave 21+); hook surgery on `useRedlineState` /
`useSigningKey` / etc. (those are stable already).

### Part C — Phase 18 first slice (dep pin + budget gate + loader stub)

**Branch:** `wave20-phase18-prep`

**Cap:** **1 new dep pin** (`@xenova/transformers`). **≤ 2 file edits**
to existing scripts/configs (`app/scripts/check-bundle-budget.mjs`
+ `app/package.json`). **1 new file** (`app/src/llm/loadClassifier.ts`)
+ **1 test file**. **No source-code consumer of `loadClassifier`** —
the function exists, its bundle impact is gated, and its test pins
the lazy-import contract. Real `analyze()` integration is Wave 21.

**Approach:**

Wave 18-B picked `Xenova/paraphrase-MiniLM-L3-v2` as the Phase 18
default with a measured precache delta of +151% (~17.5 MiB). Wave
20-C lays the infrastructure that gates the budget BEFORE the
model integration ships:

Step 1 — pin `@xenova/transformers` as a dep. Don't import it from
production source yet; just add to `app/package.json` so the lock
file pins the runtime version that Wave 21 will use.

Step 2 — extend `app/scripts/check-bundle-budget.mjs` with a
precache-delta budget. New rule: "OCR + classifier ≤ 30 MiB
combined precache" (the contract from Wave 18-B's recommendation).
The classifier lane is empty today (Wave 20 ships zero classifier
files into the bundle), so the gate passes trivially. Wave 21's
integration must respect it.

Step 3 — `app/src/llm/loadClassifier.ts`: a `loadClassifier()`
function that dynamic-imports `@xenova/transformers` lazily. Returns
a promise of an `EmbedFunction`. Does NOT run on app load. Does NOT
get called by any production source in Wave 20. Pure scaffold so
Wave 21's hybrid `analyze()` path has a known boundary to wire to.

Step 4 — `app/src/llm/loadClassifier.test.ts`: pins the lazy-import
contract — the function exists, calling it triggers the dynamic
import, and the import only runs once (caching is part of the
contract).

**Files:**

- `app/package.json` — add `"@xenova/transformers": "^X.Y.Z"` (pick
  the latest stable at PR draft time and pin via the standard
  caret-range).
- `app/scripts/check-bundle-budget.mjs` — add the precache-delta
  rule. New cap entry: classifier-precache budget.
- `app/src/llm/loadClassifier.ts` (NEW) — lazy-import stub.
- `app/src/llm/loadClassifier.test.ts` (NEW) — vitest cases pinning
  lazy-import + caching.

**Tests / verify:**

- `npm install` resolves the new dep cleanly. Lockfile updated.
- `npm run check:budget` green (classifier lane is empty; budget
  passes trivially).
- `npm test src/llm/loadClassifier.test.ts` green.
- `npm run build` succeeds; the new `@xenova/transformers` package
  is **not** in the app shell chunk (Vite tree-shakes the unused
  import or `loadClassifier` is not statically imported anywhere).
- Bundle-size budget actuals confirm the app shell didn't grow.

**Out of scope:** any actual classifier inference (Wave 21);
precaching the model into the service worker (Wave 21); shipping
a hybrid `analyze()` path (Wave 21); CSP audit for the loader
(Wave 21 once the loader is wired); model-license review.

## Merge order

A, B, C touch disjoint files. Suggested:

```
A, B, C  (parallel-safe)
   ↓
(no follow-up; each ships independently)
```

Part A's threshold bump is conditional on its own actual coverage,
not on B or C. B's `<AppCurrentPane>` extraction doesn't touch
files A or C edit. C's dep pin and loader stub don't touch files A
or B edit.

If you do all three in serial, any order works. If you parallelize,
no merge conflicts expected.

## TDD recommendation

**Direct (single Opus author) for all three** — each part has
judgment calls (which files to test in A; which props are essential
in B; how to gate the budget in C) that benefit from product
context. Subagent dispatch overhead exceeds the parallelism gain.

## Done definition

- Part A merged: branches threshold at 89 IFF actual ≥ 89.5%; new
  test files added; thresholds doc updated.
- Part B merged: `app/src/App.tsx` ≤ 550 lines; `<AppCurrentPane>`
  + `useCurrentViewState` extracted with passing tests.
- Part C merged: `@xenova/transformers` pinned; bundle-budget gate
  enforces "OCR + classifier ≤ 30 MiB"; `loadClassifier()` exists
  with passing test; nothing in production source uses it yet.
- All thresholds held; no behavior changes to the analyze pipeline.
- No new IDB store, no new audit `kind`, no new product surface.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | ≤ 6 new test files / ≤ 30 cases; threshold bump only if branches ≥ 89.5%; 0 src edits |
| B | App.tsx ≤ 550; ≤ 4 new files (1 hook + 1 sub-component + their tests); 0 behavior changes |
| C | 1 dep pin; ≤ 2 file edits; 1 new src + 1 test; no production caller |

If any cap is breached, ship what fits and roll the overflow to
Wave 21 explicitly. Do not negotiate caps up from inside a part.
