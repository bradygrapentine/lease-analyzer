# Wave 19 — App.tsx decomp finish-push + branch coverage

**Goal:** continue Wave 17/18's App.tsx decomposition with two more
extractions (one sub-component, one imperative-callbacks hook), and
finally land the contingent branch-threshold bump that Wave 18-C
deferred. Two parts, tight caps; one session.

## Scope boundary

Wave 19 owns:

- `app/src/App.tsx` (Part A only — single writer).
- `app/src/App/useAppCallbacks.ts` (NEW, Part A) — lifts the small
  imperative callbacks (`handleBytes`, `onTrySample`, `onOpenLibrary`,
  `onDeleteLibrary`, `onCompare`, `onImportArchiveFile`,
  `onExportSignedJson`) out of App's render body.
- `app/src/ui/AppFooterControls.tsx` + test (NEW, Part A) — extracts
  the encrypted-archive export/import + clear-all `<footer>` block.
- `app/vite.config.ts` and `docs/TESTING.md` (Part B only — branch
  threshold bump 88→89, contingent on Part A's actual ≥89.5%).

Wave 19 does **NOT** touch:

- IndexedDB schema, audit `kind` strings.
- Production source under `app/src/parser/`, `app/src/rules/`,
  `app/src/storage/`, `app/src/audit/`, `app/src/security/`.
- The big `<AppCurrentPane>` extraction (`view === 'current'` block,
  ~340 lines): too prop-heavy without first lifting derived state +
  imperative callbacks. Rolls to Wave 20.
- Phase 18 model integration: that's a focused 3-4 part wave on its
  own (Wave 21 candidate). Wave 19 just unblocks branch coverage so
  Wave 20 / 21 ship on a tighter floor.

## Pre-flight

1. Wave 18 (A/B + plan) merged. Wave 19 starts from `main` at or
   after `d57b1f9` (post-`wave18-B` Phase 18 measurement).
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green.
3. Verify `app/src/App.tsx` is still **844 lines**. If a separate
   commit shrunk it, recompute Part A's target.
4. Verify branches actual is still **88.66%**. If higher, Part B's
   skip-vs-bump decision changes.
5. Read each part's cap before starting. Caps are contracts.

## Parts

### Part A — AppFooterControls + useAppCallbacks

**Branch:** `wave19-app-decomp-finish`

**Cap:** App.tsx **≤ 740 lines** (from 844; that's 12% cut, 144-line
drop expected). **≤ 2 new files**: one new sub-component
(`AppFooterControls.tsx` + its test) and one new callbacks hook
(`useAppCallbacks.ts` + its test). **Zero behavior changes.** Coverage
thresholds NOT bumped here (that's Part B).

**Approach:**

Step 1 — extract `<AppFooterControls>`. The `<footer>` block (lines
812-841 of current App.tsx) is 30 lines, three buttons, three
callbacks (`exportEncryptedArchiveFlow`, `onImportArchiveFile`,
`clearAll`). Pure presentational; small, clean, mirror's Wave 17-A's
`<AppHeader>` extraction. Net ~25 line drop in App.tsx.

Step 2 — extract `useAppCallbacks`. Seven imperative callbacks live
inline in App.tsx today (`handleBytes`, `onTrySample`,
`onOpenLibrary`, `onDeleteLibrary`, `onCompare`,
`onImportArchiveFile`, `onExportSignedJson`). They're all
state-mutation orchestration — ideal for a hook. Inputs: the
upstream hook surfaces (`pipeline`, `signingKey`, `safeAudit`),
plus `setSelected` and the `refresh*` callbacks. Outputs: the same
seven callbacks bound. Net ~80 line drop in App.tsx.

Two extractions combined: 844 → ~739, just under the ≤740 cap. If
the cut comes in lighter than expected, accept the small overshoot
(document it the same way Wave 17-A and Wave 18-A did) — do NOT add
a third extraction beyond the 2-file cap.

**Files:**

- `app/src/App.tsx` — JSX + import edits.
- `app/src/ui/AppFooterControls.tsx` (NEW) — presentational; 3 props
  (callbacks). Pattern mirrors `AppHeader.tsx`.
- `app/src/ui/AppFooterControls.test.tsx` (NEW) — RTL smoke: each
  button fires its callback; the file input triggers `onImport`.
- `app/src/App/useAppCallbacks.ts` (NEW) — the hook. Single export
  function `useAppCallbacks(deps)` returning the bound callbacks.
- `app/src/App/useAppCallbacks.test.ts` (NEW) — `renderHook` cases
  for at least: `handleBytes` calls `pipeline.upload` and bookends
  with two audit entries; `onDeleteLibrary` clears standard when
  the deleted lease was the standard; `onCompare` no-ops when
  either lease is missing.

**Tests / verify:**

- `git diff main..HEAD -- app/src/App.tsx | grep '^-' | wc -l` shows
  the line drop is real.
- `App.test.tsx` + `App.panels.test.tsx` pass unchanged. Public
  selectors (aria-labels, role names) stay stable.
- `npm run test:coverage` thresholds hold (no drops below
  95/88/91/95).

**Out of scope:** the `<AppCurrentPane>` extraction (rolls to Wave
20); behavior changes; lifting `refreshLibrary` / `refreshTemplates`
/ `refreshAuditLog` into the new hook (those are state-coupled to
App's `useState` slots and should stay until App's state itself
moves).

### Part B — branch coverage threshold 88 → 89

**Branch:** `wave19-coverage-threshold`

**Cap:** **1 src file edit** (`app/vite.config.ts`) + **1 doc edit**
(`docs/TESTING.md`). **No new tests.** **Contingent on Part A's
actual coverage** — if branches < 89.5% post-A, this part SKIPS (do
not bump the threshold without 0.5% buffer).

**Approach:**

Wave 18-C deferred this same bump because A's actual landed at
88.66% — not enough buffer. Wave 19-A's two extractions add new
testable surface (the new sub-component + the new hook) which the
new test files in Part A will cover. The expectation is that branch
coverage clears 89.5% post-A; if it doesn't, Part B SKIPS again
honestly.

If branches < 89.5% post-A: Part B SKIPS. Document the actual in the
wave summary; the bump rolls to Wave 20.

If branches ≥ 89.5% post-A: bump `vite.config.ts` branches floor
from 88 to 89; update the documented actuals in `docs/TESTING.md`.

**Files:**

- `app/vite.config.ts` — `branches: 88` → `branches: 89`.
- `docs/TESTING.md` — updated thresholds + actuals paragraph.

**Tests / verify:**

- `npm run test:coverage` passes with the new floor (CI gate stays
  green).
- The actual is ≥ 89.5% (the buffer rule).
- No new tests added in this part — coverage gain is a side-effect
  of Part A's new test files.

**Out of scope:** statements / functions / lines floor bumps (no
plan target this wave); pushing for branches ≥ 90 (Wave 20+
candidate); adding tests purely to boost numbers.

## Merge order

A is the precondition for B (B reads A's actual coverage).
Suggested:

```
A    (lands first; new sub-component + hook + their tests)
   ↓
B    (reads actual coverage, bumps threshold or skips)
```

## TDD recommendation

**Direct (single Opus author) for both parts.** A has judgment calls
about what fits the hook's interface. B is too small to dispatch.

## Done definition

- Part A merged: `app/src/App.tsx` ≤ 740 lines; `<AppFooterControls>`
  and `useAppCallbacks` extracted with tests.
- Part B either merged with branches floor 89 (actual ≥ 89.5%), OR
  SKIPPED with the actual recorded in the wave summary.
- All thresholds held; no behavior changes.
- No new IDB store, no new audit `kind`, no new product surface, no
  new dep.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | App.tsx ≤ 740; ≤ 2 new files (1 sub-component + 1 hook, each with its test); 0 behavior changes; coverage NOT bumped here |
| B | 1 src + 1 doc edit; SKIPS if branches < 89.5% post-A |

If a cap is breached, ship what fits and roll the overflow to Wave
20. Do not negotiate caps up from inside a part.
