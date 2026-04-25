# Wave 10 — Multi-lease intelligence (Phase 16)

**Goal:** turn the portfolio grid (Phase 11) and per-user severity
overrides (Phase 10) into actual analytical leverage across a tenant's
library: rule rollups, clause similarity clustering, a named
"my standard" clause suite, and portfolio-scope rule overrides.
Ship Phase 16's four pillars.

## Scope boundary vs. Wave 11

Wave 10 owns everything under `app/src/portfolio/`,
`app/src/clauseStandard/`, `app/src/ui/Portfolio*`, and the
`PortfolioPanel`. Wave 11 owns `app/src/i18n/`, `app/public/glossary/`,
`app/src/ocr/`, `app/src/diagnostics/`, and risk-register docs. Both
waves touch `docs/ROADMAP.md` + `docs/BACKLOG.md` but in disjoint
sections (Wave 10 → Phase 16; Wave 11 → Phase 14 + risk register), and
both touch `docs/SYSTEM_DESIGN.md` in disjoint subsections. App.tsx
wire-up: Wave 10 mounts under the existing `portfolio` view-mode;
Wave 11 wraps `<App>` with the i18n provider at the top level and adds
a locale picker to the header — disjoint regions.

## Pre-flight

1. Wave 9 fully merged; ROADMAP shows Phase 15 Done.
2. `cd app && npm run typecheck && npm run lint && npm test` is green
   on `main`.
3. Confirm the Wave 9-A `useReviewMode` hook landed — Wave 10 panels
   must early-return a "read-only — no portfolio writes" notice when
   `reviewMode.active`. Same gate Wave 9-B applied to RedlinePanel.
4. Privacy contract still reads "no network egress after load."
   Portfolio analytics run entirely over IndexedDB-resident data; no
   new fetches.

## Parts (parallel-safe)

### Part A — Portfolio-wide rule rollups

**Branch:** `wave10-rule-rollups`

**Files:**
- `app/src/portfolio/ruleRollups.ts` (new) — pure
  `aggregateFindings(leases: LeaseRecord[]): RuleRollup[]` returning
  `{ ruleId, leaseCount, severityCounts, leaseIds[] }`. Sorted
  deterministically by `leaseCount desc, ruleId asc`.
- `app/src/portfolio/ruleRollups.test.ts` (new) — empty library, single
  lease, multi-lease overlap, severity-override resolution, ordering
  stability.
- `app/src/ui/PortfolioRollupsPanel.tsx` (new) — table of rule × count
  with drill-through (clicking a row filters the existing
  `PortfolioPanel` grid to those `leaseIds`).
- `app/src/ui/PortfolioRollupsPanel.test.tsx` (new, ≥4 cases) +
  `.stories.tsx` (new).
- `app/src/ui/PortfolioPanel.tsx` — accept an optional
  `filterLeaseIds?: string[]` prop and render the rollup panel above
  the grid. Don't restructure existing markup.

**Tests / verify:** rollup is deterministic across runs; drill-through
preserves grid filters; rollup respects severity overrides resolved
through the same path `FindingsPanel` uses.

**Out of scope:** rollups by category/jurisdiction (rule-id only this
wave); CSV export of rollup table.

### Part B — Clause similarity across leases

**Branch:** `wave10-clause-similarity`

**Files:**
- `app/src/portfolio/shingles.ts` (new) — pure
  `paragraphShingles(text: string, k = 5): string[]` (lowercased,
  whitespace-collapsed, punctuation-stripped) and
  `jaccard(a: string[], b: string[]): number`.
- `app/src/portfolio/shingles.test.ts` (new).
- `app/src/portfolio/clauseClusters.ts` (new) — given the library,
  cluster paragraphs across leases where Jaccard ≥ 0.8; emit
  `ClauseCluster { clusterId, paragraphs: { leaseId, paragraphIndex,
  text }[], representativeText }`. Deterministic ordering.
- `app/src/portfolio/clauseClusters.test.ts` (new) — synthetic
  near-duplicate leases via `parser/testFixtures.ts`.
- `app/src/storage/storage.ts` — add a v5 migration adding a
  `paragraphShingles` store keyed by `[leaseId, paragraphIndex]`,
  populated lazily on first portfolio-similarity render. Do NOT touch
  the v4 `(findingCount, rulePackVersion)` index from Wave 7-E.
- `app/src/storage/storage.test.ts` — extend with v4→v5 migration test.
- `app/src/ui/ClauseSimilarityPanel.tsx` (new) + test + story — list
  clusters; click a paragraph → opens the lease in the viewer scrolled
  to that paragraph (reuse the existing finding-click path).

**Tests / verify:** identical paragraphs cluster; near-identical (one
edited word, ≥80% Jaccard) cluster; unrelated paragraphs do not;
migration v4→v5 preserves all existing data.

**Out of scope:** semantic similarity (lexical only); cross-cluster
canonical-form generation; hashing of redlined-edit paragraphs (apply
to original `LeaseDocument.paragraphs` only).

### Part C — "My standard" clause suite

**Branch:** `wave10-standard-suite`

**Files:**
- `app/src/clauseStandard/standardSuite.ts` (new) — IDB store
  `leaseguard-standards` v1: `{ id, name, sourceLeaseId,
  sourceParagraphIndex, normalizedText, createdAt }`. Module owns CRUD
  + `_resetStandardsDbForTests`.
- `app/src/clauseStandard/standardSuite.test.ts` (new).
- `app/src/clauseStandard/compareToStandard.ts` (new) — given a lease
  and the suite, emit
  `StandardComparison[] { standardId, paragraphIndex | null,
  similarity }` reusing Part B's `jaccard` (peer dependency: Part B's
  `shingles.ts`).
- `app/src/clauseStandard/compareToStandard.test.ts` (new).
- `app/src/ui/StandardSuitePanel.tsx` (new) + test + story — list
  standards, "Promote this paragraph to standard" button rendered next
  to a finding's paragraph in `FindingsPanel` (additive prop, behind a
  feature predicate).
- `app/src/ui/FindingsPanel.tsx` — accept optional
  `onPromoteToStandard?: (leaseId, paragraphIndex) => void` callback;
  default undefined keeps existing behavior identical.

**Soft dependency on B:** imports `paragraphShingles` + `jaccard`. Use
`import type` where possible and rebase onto B at merge.

**Tests / verify:** promote → list shows standard; comparison surfaces
matches above 0.8; deletion removes from suite without orphans; audit
entry `kind: 'standard-promote'` / `'standard-delete'` written via
`safeAudit`.

**Out of scope:** per-jurisdiction standard suites; export/import of
standards (Phase 16 follow-up).

### Part D — Portfolio-level severity / rule overrides

**Branch:** `wave10-portfolio-overrides`

**Files:**
- `app/src/rules/portfolioOverrides.ts` (new) — extends the existing
  per-user override model with a `scope: 'lease' | 'portfolio'`
  discriminator. Resolution order: lease-scope > portfolio-scope >
  pack default. Persists via `packStorage` (extend existing
  `getSeverityOverrides` to accept a scope filter; no schema bump
  needed if we encode scope in the key — document the encoding in the
  module header).
- `app/src/rules/portfolioOverrides.test.ts` (new) — resolution order,
  conflict cases, migration of pre-existing lease-scope rows.
- `app/src/rules/severityOverrides.ts` — thread the resolver through
  `applySeverityOverrides(...)` so consumers don't need to know about
  scope. Existing call sites must keep working unchanged.
- `app/src/ui/SeverityOverridesPanel.tsx` — add a "Apply across
  portfolio" toggle next to each override row.
- `app/src/ui/SeverityOverridesPanel.test.tsx` — extend with ≥2 cases
  for the portfolio toggle + resolution.

**Tests / verify:** lease-scope overrides win over portfolio-scope;
portfolio-scope applies to leases that have no lease-scope row;
removing portfolio override falls back to pack default; existing
fixture tests still pass.

**Out of scope:** per-jurisdiction portfolio overrides; rule
disable/enable at portfolio scope (severity only this wave).

## Merge order

A and D are independent of B/C and can land in any order. C depends
on B (`shingles` / `jaccard`). Suggested: **A → B → C → D**, with A and
D in flight in parallel from the start.

## TDD recommendation

Run as `/tdd-wave 10`. The clustering + override-resolution logic
benefits from spec-first tests; the panels are straightforward RTL
once the pure modules are pinned.

## Done definition

- All four PRs merged.
- ROADMAP Phase 16 moves from "Forward phase" to "Done"; new forward
  phases (if any) added.
- BACKLOG gains a Phase 16 section with all four items ticked +
  footprint refreshed (new IDB stores: `leaseguard-standards` v1;
  `leaseguard` bumped to v5 with `paragraphShingles`).
- `docs/SYSTEM_DESIGN.md` gains a "Multi-lease intelligence" subsection
  describing the cluster + standard-suite resolution paths.
- Privacy contract re-affirmed: zero network egress; clustering runs
  over IDB-resident data only.
