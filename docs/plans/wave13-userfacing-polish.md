# Wave 13 — User-facing polish

**Goal:** finish the four user-visible affordances that have been
"started but not done" for several phases — the onboarding tour
beyond the sample-lease button, side-letter PDF export alongside the
HTML artifact, full marketplace UI for curated packs, and bulk-import
support for zipped folders of PDFs. All four touch product surface;
none introduce a new IDB schema.

## Scope boundary vs. Wave 12

Wave 13 owns:

- `app/src/ui/OnboardingTour.tsx` + `.test.tsx` + `.stories.tsx`,
  `app/src/ui/SideLetterPanel.tsx` + tests + stories,
  `app/src/ui/MarketplacePanel.tsx` + tests + stories.
- `app/src/workflow/sideLetter.ts` (NEW — extract the existing HTML
  builder from `SideLetterPanel` into a pure module so the PDF export
  can sit beside it), `app/src/workflow/sideLetterPdf.ts` (NEW),
  `app/src/workflow/bulkImport.ts` (extend; today the module owns
  per-file progress + dedup, this wave adds zip detection +
  per-entry yield).
- `app/src/storage/storage.ts` — only the existing
  `getOnboardingDismissedAt` / `setOnboardingDismissedAt` API. No
  schema bump. No new stores.
- `app/src/App.tsx` — additive wire-up only (mount the expanded
  tour; pass the new bulk-import props; pass the marketplace props).
  Do NOT restructure the file or change unrelated handlers.

Wave 13 does NOT touch repo-root config, `.husky/`, `.github/`,
`tests/e2e/`, `app/src-tauri/`, or any test-infra config. Those
belong to Wave 12.

Soft point of contact with Wave 12: both waves bump
`app/package.json` (Wave 12 adds devDeps; Wave 13 may add a tiny PDF
dep IF `pdf-lib` doesn't already cover the side-letter use case —
pre-flight verifies this and the wave defaults to reusing `pdf-lib`).

## Pre-flight

1. Wave 10 + Wave 11 + Wave 12 (A and C at minimum) merged. C is the
   hard prerequisite — Wave 13 docs additions to BACKLOG/ROADMAP must
   not collide with Wave 12-C's risk-register updates. If Wave 12 has
   not landed C yet, defer the BACKLOG sync at the end of Wave 13 to
   a single follow-up commit owned by whichever wave merges last.
2. `cd app && npm run typecheck && npm run lint && npm test` is green
   on `main`.
3. Confirm `app/src/workflow/bulkImport.ts` already owns per-file
   progress + dedup (Wave 6/7 vintage). Wave 13-D extends; it does
   not rewrite.
4. Confirm `app/src/ui/MarketplacePanel.tsx` already exists from
   Wave 8-A. Wave 13-C's job is to finish the wire-up (the open
   BACKLOG item is "surface them in-app", not "build the panel").
5. Confirm `app/src/ui/SideLetterPanel.tsx` exists and renders the
   HTML preview today. Wave 13-B factors out the HTML build, adds
   PDF, replaces the popup-window preview with an in-app preview.
6. `pdf-lib` is already a dep (used by `parser/testFixtures.ts` and
   the redline export). Wave 13-B reuses it; no new dep expected.

## Parts (parallel-safe)

### Part A — Onboarding tour expansion

**Branch:** `wave13-onboarding-tour`

**Files:**
- `app/src/ui/OnboardingTour.tsx` — extend the current
  sample-lease-button entry into a 4-step walkthrough:
  1. Upload / sample-lease (existing).
  2. Findings panel — explain severity + click-to-highlight.
  3. Portfolio view — explain rule rollups (Wave 10-A) + standard
     suite (Wave 10-C).
  4. Audit log + signed export — point at the Phase 12 surface.
- `app/src/ui/OnboardingTour.test.tsx` — extend with: each step
  renders correct copy; "Next" advances; "Skip" dismisses; final
  "Done" sets `onboardingDismissedAt` via the existing IDB write.
- `app/src/ui/OnboardingTour.stories.tsx` — one story per step.
- `app/src/App.tsx` — additive: pass current view-mode into the
  tour so step 3/4 can highlight the correct top-level button. Do
  NOT restructure mount logic.
- `docs/SYSTEM_DESIGN.md` — short note in the existing privacy
  contract section (or a new "Onboarding" subsection) that the tour
  is purely client-side and never fetches.

**Tests / verify:**
- All four steps render with deterministic copy.
- Dismissal writes the existing `getOnboardingDismissedAt` key — no
  new keys.
- Existing tests for the sample-lease button still pass unchanged.

**Out of scope:** keyboard-trap focus management for the tour overlay
(separate a11y wave); analytics-style "step N completed" events
(would violate the no-telemetry contract); multi-tour replay (one
tour, dismiss-once).

### Part B — Side-letter PDF export + in-app preview

**Branch:** `wave13-side-letter-pdf`

**Files:**
- `app/src/workflow/sideLetter.ts` (new) — extract the existing
  HTML builder out of `SideLetterPanel.tsx` into a pure
  `buildSideLetterHtml(input): string`. This is a pure refactor;
  behavior identical.
- `app/src/workflow/sideLetter.test.ts` (new) — pin the HTML output
  byte-for-byte against a fixture so the refactor is provably a
  no-op.
- `app/src/workflow/sideLetterPdf.ts` (new) —
  `buildSideLetterPdf(input): Promise<Uint8Array>` using `pdf-lib`
  (existing dep). Hand-rolled layout in the spirit of
  `buildHandoffZip`'s mini-PDF helper; deterministic output (pin a
  fixed creation date in the metadata so byte-equality holds in
  tests).
- `app/src/workflow/sideLetterPdf.test.ts` (new) — golden bytes
  test, plus a parse-roundtrip via `pdf-lib`'s `PDFDocument.load`
  to assert the bytes are valid PDF.
- `app/src/ui/SideLetterPanel.tsx` — replace the
  `window.open(...)` popup preview with an in-panel `<iframe srcdoc>`
  preview (or a `<pre>` for plain text — pick the rendering that
  reuses the most existing CSS). Add an "Export PDF" button next
  to the existing "Export HTML". Both routes share the new pure
  `workflow/sideLetter` modules.
- `app/src/ui/SideLetterPanel.test.tsx` — extend with: in-panel
  preview shows the built HTML; "Export PDF" download fires; HTML
  export still works (regression).

**Tests / verify:**
- Byte-identical HTML before/after refactor (golden test).
- PDF byte stream validates via `pdf-lib` parse.
- No new audit `kind` strings — both exports go through the existing
  `safeAudit({ kind: 'export', payload: ... })` channel, with payload
  distinguishing `format: 'html' | 'pdf'`.

**Out of scope:** print stylesheet rework; multi-page side-letter
layout beyond the existing single-page flow; CSV export (separate
follow-up).

### Part C — Marketplace UI wire-up

**Branch:** `wave13-marketplace-wireup`

**Files:**
- `app/src/ui/MarketplacePanel.tsx` — finish the wire-up: list every
  curated pack from `app/public/packs/curated/`, show the verified
  badge (Wave 8-A), expose a one-click install that calls the
  existing `importPack` flow, and show diff-vs-installed via the
  existing `pack-diff` panel.
- `app/src/ui/MarketplacePanel.test.tsx` — extend with: empty
  state, populated state, install fires existing `importPack`
  callback, diff-preview opens.
- `app/src/storage/packStorage.ts` — additive read-only helper
  `listCuratedPackUrls(): string[]` returning the static list of
  curated pack paths. Do NOT mutate any persisted state.
- `app/src/App.tsx` — mount `<MarketplacePanel>` under the existing
  pack-manager view (find the right slot; do NOT restructure the
  view-mode switch).

**Tests / verify:**
- Empty state renders if no curated packs are present.
- Install flows reuse the existing `importPack` audit `kind` —
  no new audit strings.
- Verified-badge resolution matches `packBaseline.ts`'s existing
  signature check.

**Out of scope:** remote pack discovery (CSP forbids); user-uploaded
packs to the marketplace (curated-only); rating / review system.

### Part D — Bulk import: zipped folder of PDFs

**Branch:** `wave13-bulk-zip-import`

**Files:**
- `app/src/workflow/bulkImport.ts` — extend with zip detection: if
  the user picks a `.zip`, walk entries, dedupe via the existing
  content-hash store, and yield per-PDF progress events through the
  existing progress callback. Reuse the JSZip dep that already
  powers `buildHandoffZip` / `replayBundle.ts`.
- `app/src/workflow/bulkImport.test.ts` — extend with: synthetic
  zip containing 3 PDFs (one duplicate of an already-imported lease,
  one fresh, one corrupted); assert dedup skips the dup, fresh
  imports, corrupted surfaces a per-entry error without aborting
  the batch.
- `app/src/ui/BulkImportPanel.tsx` — single label tweak: the file
  input `accept` attribute gains `.zip`; the progress UI surfaces
  per-entry errors in the existing list rendering. No structural
  changes.
- `app/src/ui/BulkImportPanel.test.tsx` — extend with one zip-import
  case to cover the UI loop.
- `docs/SYSTEM_DESIGN.md` — short bullet under "Privacy contract"
  noting the zip path is processed in-memory; nothing extracted to
  disk; no network egress.

**Tests / verify:**
- Existing per-file PDF import path unchanged (regression).
- Zip path dedupes correctly using the existing
  `leaseguard-bulk-dedup` store; no schema bump.
- Audit emits one `bulk-import` entry per resulting saved lease,
  matching today's per-file behavior.

**Out of scope:** nested-folder zip layouts (top-level entries
only); password-protected zips; per-entry retry UI.

## Merge order

A, B, D are independent of each other. C touches App.tsx wire-up
last to avoid wasted rebases.

Suggested: **A → B → D → C** with A and B safe to land in parallel.

D rebases onto B-merged main only if both touch BulkImportPanel —
they don't, so D is fully parallel with B.

If pursued under TDD dispatch (see below), C waits for the
implementer pool to drain because its App.tsx wire-up is the most
likely conflict source if the assistant has been ad-hoc editing
App.tsx during A's tour mount.

## TDD recommendation

**Run as `/wave 13-X` per part with TDD discipline IF prior waves
in this session have produced "mostly_achieved" outcomes.** Otherwise
direct dispatch is fine — the success criteria are crisp and the
panels are small.

Pure modules that benefit from spec-first tests:

- `workflow/sideLetter.ts` (HTML builder; golden output).
- `workflow/sideLetterPdf.ts` (PDF builder; byte-equality golden).
- Extension of `workflow/bulkImport.ts` (zip walk + dedup +
  per-entry error surface).

Panel tests are RTL — straightforward once the pure modules are
pinned.

## Done definition

- All four PRs merged.
- ROADMAP Phase 6 ticks: onboarding tour → Done; (Lighthouse already
  ticked by Wave 12-D pre-flight).
- BACKLOG ticks: onboarding tour, side-letter PDF export, side-letter
  preview, marketplace UI wire-up, bulk import zip support.
- `docs/SYSTEM_DESIGN.md` gains: short onboarding subsection;
  bulk-import zip note in the privacy contract.
- No new IDB stores, no schema bumps. New audit `kind` strings: NONE
  (everything reuses `export`, `import-pack`, `bulk-import`).
- Privacy contract reaffirmed: zero network egress; tour, side-letter,
  marketplace, and bulk-import all run over local data only.

## Notes for cross-wave coordination

If Wave 12 lands first:
- Wave 13's BACKLOG ticks slot beneath Wave 12's. No conflict
  expected — Wave 12 ticks risk-register + infra rows; Wave 13 ticks
  Phase 6 + workflow rows.
- The new pre-commit hook (Wave 12-A) will run on Wave 13 commits;
  expect ESLint to flag any unused imports introduced during the
  pure-module extraction in 13-B before commit.

If Wave 13 lands first:
- Wave 12-D's commercial-table golden expansion is unaffected by
  any Wave 13 work (the goldens live in `app/src/rules/`, untouched
  by Wave 13).
- Wave 12-C's `docs/SECURITY.md` §5 addition is in a different
  section than the bullet Wave 13-D adds to "Privacy contract" —
  no merge conflict expected.
