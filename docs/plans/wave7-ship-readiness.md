# Wave 7 — Ship-readiness

**Goal:** close the gap to 1.0. Finish Phase 6's ship-readiness items
(Lighthouse CI, Tauri build, onboarding tour, commercial golden), and
clear the two largest cross-cutting tech-debt rocks (App.tsx
decomposition with the reanalyze-staleness guard, secondary IDB index).
After Wave 7 the product should be auditable end-to-end and the codebase
should not have any ticket older than Phase 13 still open.

## Pre-flight

Before any part starts:

1. `git fetch origin && git log origin/main --oneline -5` — confirm main is at or past `2b3dd79` (`docs: sync ROADMAP + BACKLOG with wave 6 shipments`).
2. `cd app && npm ci && npm run typecheck && npm run lint && npm test` — green baseline.
3. No open wave6-* branches on remote (`git branch -r | grep wave6` returns empty).

If any check fails: STOP, report, do not start parts.

## Parts (parallel-safe)

Each part is one PR. Files-touched lists are scope contracts —
agents must not edit outside them without escalation. Test files are
written **first** (red), then implementation (green), then refactor.

### Part A — Lighthouse + Tauri CI gates

**Branch:** `wave7-ci-gates`

**Files:**
- `.github/workflows/lighthouse.yml` (new)
- `.github/workflows/tauri.yml` (new)
- `app/lighthouserc.json` (new) — config asserting a11y ≥ 95, PWA ≥ 95, best-practices ≥ 90, no perf gate yet
- `app/src-tauri/tauri.conf.json` (verify present)
- `docs/CLAUDE.md` (update Commands section with `npm run lhci` reference if added)

**Tests / verify:**
- Lighthouse workflow runs `npm run build && npx @lhci/cli autorun` against `dist/` via a local static server. Job fails if a11y < 95 or PWA < 95.
- Tauri workflow runs on `ubuntu-latest`, installs Rust toolchain, runs `cargo tauri build --bundles deb` (Linux only — macOS/Windows artifacts are follow-up), uploads `.deb` as a workflow artifact.
- Both workflows trigger on pull_request to main.
- `gh workflow view lighthouse` and `gh workflow view tauri` show as registered.

**Out of scope:** macOS/Windows Tauri targets (need code-signing setup), perceptual perf budgets in Lighthouse, branch protection update.

### Part B — First-run onboarding tour

**Branch:** `wave7-onboarding`

**Files:**
- `app/src/ui/OnboardingTour.tsx` (new) — 4-step modal: (1) local-first contract, (2) upload or sample-lease, (3) findings interaction, (4) OCR opt-in disclosure
- `app/src/ui/OnboardingTour.test.tsx` (new) — RTL: renders on first run, dismiss persists, never re-opens, keyboard nav, focus trap
- `app/src/ui/OnboardingTour.stories.tsx` (new) — Storybook
- `app/src/storage/storage.ts` — extend settings store to add `onboardingDismissedAt: number | null`
- `app/src/storage/storage.test.ts` — migration + setter test
- `app/src/App.tsx` — mount `<OnboardingTour onDismiss={...} />` behind `settings.onboardingDismissedAt == null` guard
- `app/src/App.panels.test.tsx` — wipe step seeds dismissed=Date.now() so the tour doesn't intercept other tests

**Tests / verify:**
- `OnboardingTour.test.tsx`: 5 cases — initial render, all 4 steps reachable via Next/Back, dismiss writes settings, second mount with `dismissedAt` set returns null, Esc dismisses.
- Lighthouse a11y still ≥ 95 (Part A gate).
- jsdom: focus management uses `tabindex` not real focus events.

**Out of scope:** in-app re-trigger button (settings → "Show tour again"), animated transitions, multi-locale strings.

### Part C — Commercial golden fixture

**Branch:** `wave7-golden-commercial`

**Files:**
- `app/src/parser/testFixtures.ts` — extend `buildCommercialLeasePdf()` (or add new `buildEnterpriseCommercialPdf()`) to embed: (a) a 4-row rent schedule table with escalators, (b) 6+ defined terms via `"X" shall mean Y` and `X means Y`, (c) cross-references to sections, exhibits, schedules
- `app/src/golden/commercial.golden.test.ts` (new) — single test file asserting `parseLease` + `analyze` + `extractLeaseFacts` + table extraction + cross-ref resolver all return the expected shape simultaneously
- `app/src/rules/golden.test.ts` — extend the "not-in-other" assertion if commercial-specific rule ids fire
- `docs/RULES.md` — note the fixture as the canonical multi-feature regression check

**Tests / verify:**
- `commercial.golden.test.ts` asserts exact counts (≥3 tables expected? ≥6 definitions, ≥4 cross-refs, RentSchedulePeriod count, etc.) — pin the numbers.
- Ratchet: any future parser change that drops a feature on the fixture must explicitly update the snapshot, not silently regress.
- Add to footprint table in `docs/BACKLOG.md` (test count bump).

**Out of scope:** real (non-synthetic) commercial PDF binary, OCR golden, multi-jurisdiction golden.

### Part D — App.tsx decomposition + reanalyze-staleness guard

**Branch:** `wave7-appHooks`

**Files:**
- `app/src/App/usePackManager.ts` (new) — extracts pack import/enable/disable/severity-override handlers from App.tsx
- `app/src/App/useAnnotations.ts` (new)
- `app/src/App/useRedlineState.ts` (new)
- `app/src/App/useVersionHistory.ts` (new)
- `app/src/App/useSideLetter.ts` (new)
- `app/src/App/useCounterOffers.ts` (new)
- `app/src/App/useSigningKey.ts` (new)
- `app/src/App/useReanalyzeOnRulesChange.ts` (new) — useEffect keyed on `[activeRules, jurisdictions, severityOverrides]`, calls `pipeline.reanalyze()`. Replaces every manual reanalyze call site.
- `app/src/App.tsx` — target ≤ 600 lines; only renders panels and wires the hooks together
- One test file per new hook: `*.test.ts` covering happy path + one error path
- `app/src/App/useReanalyzeOnRulesChange.test.tsx` — proves auto-rerun fires on rules-array identity change but not on unrelated state churn

**Tests / verify:**
- All existing `App.panels.test.tsx` cases still pass without modification (behavior preserved).
- `wc -l app/src/App.tsx` returns ≤ 600.
- New hook tests: ≥ 14 cases total (2 per hook).
- Reanalyze guard test asserts (a) initial mount does not double-analyze, (b) toggling jurisdictions triggers exactly one reanalyze, (c) unmounting between rule changes is safe.

**Out of scope:** further pure-data extractions (rule-pack diff helpers, etc.), CSS file split, prop-drilling refactor across panels.

### Part E — Secondary IndexedDB index

**Branch:** `wave7-idb-index`

**Files:**
- `app/src/storage/storage.ts` — bump `leaseguard` DB to v4, add v4 migration gate creating compound index `by-finding-and-pack` on `[findingCount, rulePackVersion]`
- `app/src/storage/storage.test.ts` — migration test (v3 → v4 preserves rows, index queryable)
- `app/src/storage/listLeasesFiltered.ts` (new) — typed query helper using the new index
- `app/src/storage/listLeasesFiltered.test.ts` (new)
- `app/src/ui/PortfolioPanel.tsx` — consume the helper for filter UI (but do not redesign UI)

**Tests / verify:**
- Migration test seeds a v3 DB, opens via the v4 path, asserts no row loss + index exists.
- Filtered query returns expected subset for `(findingCount: 0, rulePackVersion: '1.0.0')`.
- `_resetMainDbForTests()` still works for the v4 schema.
- `App.panels.test.tsx` IDB wipe sequence still drains cleanly.

**Out of scope:** rewriting PortfolioPanel filter UX, paginating large lists, changing `LeaseRecord` shape.

## Merge order

A, B, C, E are independent — merge as they finish, any order.
D is the largest and touches App.tsx most aggressively; rebase D last
to absorb whatever else landed. If D conflicts with B (App.tsx mount
point), B wins — D's rebase reapplies the onboarding mount inside the
new hook layout.

## Done definition

- All five PRs merged.
- `npm run test:coverage` still ≥ 95/87/91/95.
- BACKLOG: Phase 6 onboarding + Lighthouse + Tauri ticked, Phase 13 IDB index ticked, App.tsx + reanalyze tech-debt items ticked, footprint table refreshed.
- ROADMAP: Phase 6 status moves to "Done"; Phase 13 status moves to "Done"; tech-debt section trimmed.
