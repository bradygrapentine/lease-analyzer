# Wave 45-BE — Renter IA Split + Error-Discipline Pass Implementation Plan

**Goal.** Split the 278-line `AppCurrentPane.tsx` god-pane into a renter-friendly information architecture (priority findings on top, supporting context below the fold), and in the same touch absorb the severity-vs-negative discipline pass (Wave 45-E) across the seven panels touched by this wave. After this wave, no inline `role="alert"` paragraph in the affected files uses raw color-only signaling, and `AppCurrentPane` is a coordinator (≤120 lines) that composes a small number of named regions.

**Architecture.** `AppCurrentPane.tsx` becomes a thin coordinator that composes three new region components: `<ResultsHeader>` (export actions + signed-export disclosure), `<ScannedPdfNotice>` (the OCR banner), and `<SupportingContext>` (annotations / counter-offer / template-matches / lease-facts / workflow). The Findings + PDF split stays as the eye-level region. Error rendering across all seven affected panels routes through a shared inline-error treatment that uses the `<Badge severity="high">` primitive (shipped in 45-A) instead of bespoke `text-severity-high` paragraphs.

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4 with `@theme {}` tokens, Vitest + RTL, Storybook 8 CSF.

**Base SHA.** `origin/main` after Wave 45-D merge (commit `d66fb81` or descendant). Verify `git fetch origin && git log origin/main --oneline -5` before branching.

**Prerequisites.** Wave 45-A merged (`<Badge>` primitive must exist at `app/src/ui/system/Badge.tsx`). Wave 45-D merged (clarify copy is on `main`). Wave 45-F merged (focus-trap primitive available; not directly consumed but shares system/ surface).

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave45-be-renter-ia-and-error-discipline`.
2. **No new dependencies.** Reuse `<Badge>`, `<Card>`, `<Button>`. The OCR-error message and other inline `role="alert"` paragraphs render through `<Badge severity="high">` plus body copy — no new error-banner component.
3. **`AppCurrentPane.tsx` budget: ≤120 lines after split.** Verify with `wc -l` in the wave's verification step.
4. **Public prop surface of `AppCurrentPane` does not change.** App.tsx call site is untouched.
5. **Aria/data inventory preserved verbatim.** The four landmarks listed in `AppCurrentPane.tsx:10-14` (`role="status"` ocr-banner, `aria-live="polite"` ocr-progress, `role="alert"` ocr-error, `aria-label="selected finding"` Card) must survive the extraction. Add a regression test that asserts each is still queryable from `AppCurrentPane` rendered with appropriate state.
6. **Storybook coverage** for each new region component (one happy-path story each). The all-stories axe sweep (`app/src/ui/__tests__/all-stories.a11y.test.tsx`) must remain green.
7. **Real-browser a11y gate.** `npx playwright test tests/e2e/a11y.spec.ts` must pass before push (per memory: jsdom axe is blind to color-contrast on tinted error surfaces).
8. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push.
9. **Codex adversarial gate** (`/codex-review` or `codex-adversarial-gate` skill) runs before `gh pr ready`. Findings either fixed or logged to `.codex-runs/escalations.jsonl` per project policy.

## §2 Out of scope

- The `ComparePanel` rewrite (Wave 45-C, parallel sibling wave). 45-BE must not touch `app/src/ui/ComparePanel.tsx` or `app/src/ui/AppLibraryAndPacksPane.tsx`.
- Lifting the inline `extractLeaseFacts` / `matchTemplates` / `needsOcr` derivations into a hook (the `// Wave 21 candidate` note in the current header). Keep the derivation site identical; only the JSX moves.
- New status (positive / negative) variants on `<Badge>`. 45-A defined severity-only; if an error-site treatment needs a non-severity variant, document it as a Wave 46 follow-up rather than expanding `<Badge>` here.
- Migrating `SeverityOverridesPanel.tsx:48-52` inline severity-bg to `<Badge>` (already noted as 45-A backlog).
- Restructuring panels other than the seven listed in §3.

## §3 Files in scope

**Restructure (Track BE-1, IA split):**
- Modify: `app/src/ui/AppCurrentPane.tsx` (target ≤120 lines)
- Create: `app/src/ui/AppCurrentPane/ResultsHeader.tsx`
- Create: `app/src/ui/AppCurrentPane/ResultsHeader.test.tsx`
- Create: `app/src/ui/AppCurrentPane/ResultsHeader.stories.tsx`
- Create: `app/src/ui/AppCurrentPane/ScannedPdfNotice.tsx`
- Create: `app/src/ui/AppCurrentPane/ScannedPdfNotice.test.tsx`
- Create: `app/src/ui/AppCurrentPane/ScannedPdfNotice.stories.tsx`
- Create: `app/src/ui/AppCurrentPane/SupportingContext.tsx`
- Create: `app/src/ui/AppCurrentPane/SupportingContext.test.tsx`
- Modify: `app/src/ui/AppCurrentPane.test.tsx` (extend to assert preserved aria landmarks + region composition)

**Error-discipline pass (Track BE-2, six sibling panels):**
- Modify: `app/src/ui/ShareReviewPanel.tsx` (lines 71, 76, 93)
- Modify: `app/src/ui/DeltaPanel.tsx` (line 86)
- Modify: `app/src/ui/CustomRuleBuilderPanel.tsx` (lines 124-127, 281, 317-320)
- Modify: `app/src/ui/CounterSignPanel.tsx` (line 74)
- Modify: `app/src/ui/OpenDeltaPanel.tsx` (line 78)
- Modify: `app/src/ui/OpenReviewPanel.tsx` (line 105)
- Modify: matching `*.test.tsx` files for each (assert `<Badge severity="high">` or equivalent appears alongside the `role="alert"` text)

## §4 Execution

**Direct, single-track within the wave; two logical sub-tracks (BE-1 IA split, BE-2 error-discipline pass) executed sequentially in that order.** Estimated 3-4 hours total. Reason for serial-not-parallel within the wave: BE-2 modifies the inline error treatment in `ScannedPdfNotice` (extracted in BE-1), so BE-2 must build on BE-1's extraction.

### Item BE-1.1 — Extract `ResultsHeader`

**Why.** The first 35 lines of `AppCurrentPane.tsx` (lines 117-152) are a self-contained header: three export buttons + the "What is signed export?" disclosure shipped in Wave 45-D. Lifting them into a named region clarifies that the renter's first decision in the post-analysis view is "what do I do with these findings," which is an IA win independent of the rest of the split.

**Scope.**
- New file `app/src/ui/AppCurrentPane/ResultsHeader.tsx` exporting `<ResultsHeader>` with props `{ status, hasSigningKey, onExportJson, onExportSignedJson, onExportHtml }`.
- Move the `exportFindingsAsHtml` call site behind a parent-supplied `onExportHtml` prop so the region stays presentational — no `App/appHelpers` import inside the region.
- Keep the `useI18n` `t` call site inside the region (it's pure-presentational).

**Tests.** Assert the three buttons render with their i18n labels; assert the signed-export details/summary disclosure renders only when `hasSigningKey` is true; assert the disclosure body text matches the Wave 45-D copy verbatim.

**Storybook.** One story `<ResultsHeader status={fixture} hasSigningKey={true} ... />`.

**Commit.** `refactor(45-be): extract ResultsHeader from AppCurrentPane`.

### Item BE-1.2 — Extract `ScannedPdfNotice`

**Why.** Lines 153-185 (the `ocr.likelyScanned` branch) are the second self-contained region: a status banner + OCR controls + progress + error. Today this banner buries the most important user-action ("Attempt OCR") under conditional rendering inside a 30-line block; lifting it into a region also creates the seam where BE-2 will swap the inline `role="alert"` color-only error for a `<Badge severity="high">` treatment.

**Scope.**
- New file `app/src/ui/AppCurrentPane/ScannedPdfNotice.tsx` exporting `<ScannedPdfNotice>` with props `{ ocr, ocrState, ocrLanguage, ocrLanguages, setOcrLanguage, hasBytes, onAttemptOcr }`.
- Render only when `ocr.likelyScanned` is true (caller passes the result of `needsOcr(doc)`; region returns `null` otherwise).
- Preserve the `role="status"` outer div, `aria-live="polite"` progress paragraph, and `role="alert"` error paragraph verbatim. Do NOT change the error-paragraph treatment in BE-1.2 — that's BE-2's job.

**Tests.** Assert each of three states renders the right landmark: idle (no progress, no error), running (`aria-live="polite"` progress), error (`role="alert"` error). Assert the "Attempt OCR" button is hidden when `hasBytes` is false or `ocrState.kind === 'running'`.

**Storybook.** Three stories — idle, running, error.

**Commit.** `refactor(45-be): extract ScannedPdfNotice from AppCurrentPane`.

### Item BE-1.3 — Extract `SupportingContext`

**Why.** Lines 234-275 (annotations, counter-offer, template matches, lease-facts, workflow) are five panels rendered in fixed order below the findings split. They are "supporting context" for a renter — none of them are decisions the renter makes first. Grouping them under one region named `<SupportingContext>` makes the IA legible: above the split = priority findings; the article card = the active selection; below the split = supporting material.

**Scope.**
- New file `app/src/ui/AppCurrentPane/SupportingContext.tsx` exporting `<SupportingContext>` with props that thread through to its five children. Accept `{ status, selected, analyzedLeaseId, annotationsApi, counters, templates, leaseFacts, suggestedEditByRuleId, onBuildIcs }`.
- Move the inline `matchTemplates(templates, status.result.doc)` call into the region (single call site; region owns it).
- Move the `buildSummary` / `copyToClipboard` / `downloadHandoffZip` lambdas into the region.

**Tests.** Assert the five child panels render in the prescribed order. Snapshot is acceptable here only if the snapshot is asserted to be ≤30 lines; otherwise structural assertions per child.

**Storybook.** One story with a populated fixture.

**Commit.** `refactor(45-be): extract SupportingContext from AppCurrentPane`.

### Item BE-1.4 — Slim coordinator + verify aria inventory

**Scope.**
- Rewrite `app/src/ui/AppCurrentPane.tsx` to compose `<ResultsHeader>`, `<ScannedPdfNotice>`, the existing `<FindingsPanel>` + `<PdfViewer>` split, the selected-finding `<Card>`, and `<SupportingContext>` in that order.
- Confirm `wc -l app/src/ui/AppCurrentPane.tsx` is ≤120.
- Extend `app/src/ui/AppCurrentPane.test.tsx` with one test that renders the coordinator with a state that exercises all four aria landmarks (`role="status"`, `aria-live="polite"`, `role="alert"`, `aria-label="selected finding"`) and asserts each is in the document.

**Commit.** `refactor(45-be): slim AppCurrentPane coordinator + aria inventory test`.

### Item BE-2.1 — Replace `ScannedPdfNotice` OCR-error paragraph with `<Badge>` + body

**Why.** The current `<p role="alert" className="text-body text-severity-high">…</p>` (now in `ScannedPdfNotice` after BE-1.2) signals severity by color alone — the WCAG concern that motivated 45-A. Pair the paragraph with a `<Badge severity="high" label="OCR failed" />` so the signal is icon + label + tinted background, not color alone. Body text remains in `<p role="alert">` (the alert landmark stays on the body so screen-readers announce the message, not the badge label).

**Scope.**
- In `app/src/ui/AppCurrentPane/ScannedPdfNotice.tsx`, render `<Badge severity="high" label="OCR failed" />` immediately before the `<p role="alert">` in the error branch. Keep the body text (`OCR didn't finish reading this PDF…`) verbatim — Wave 45-D already clarified it.
- Update the existing test for the error state to assert both the badge and the alert paragraph.

**Commit.** `fix(45-be): pair OCR-error paragraph with severity badge (color-not-alone)`.

### Item BE-2.2 — Apply the same treatment to six sibling panels

**Why.** Each of the six panels listed in §3 has at least one `<p role="alert">` that signals error severity by class name (`className="error"` or unstyled red text). The discipline rule from 45-A §2 ("Severity-vs-negative discipline pass on app-error sites") is: every error paragraph pairs with a `<Badge>` so the signal is not color-only.

**Scope (per file).**
- `ShareReviewPanel.tsx`: pair the three `role="alert"` sites (lines 71, 76, 93). Line 71 is an inline guidance note ("Requires a signed pack to share."); pair with `<Badge severity="info" label="Signed pack required" />`. Lines 76 and 93 are error states; pair with `<Badge severity="high" label="Error" />`.
- `DeltaPanel.tsx` (line 86): pair with `<Badge severity="high" label="Error" />`.
- `CustomRuleBuilderPanel.tsx`: line 127 (duplicate-ID error) and line 320 (regex parse error) — pair each with `<Badge severity="high" label="Invalid" />`. Line 281 is a per-line validation error inside a `<ul>` — pair the parent `<ul>` with a single `<Badge severity="high" label="Validation errors" />` rather than badging each `<li>`.
- `CounterSignPanel.tsx` (line 74): pair with `<Badge severity="high" label="Sign failed" />`.
- `OpenDeltaPanel.tsx` (line 78): pair with `<Badge severity="high" label="Verification failed" />`.
- `OpenReviewPanel.tsx` (line 105): pair with `<Badge severity="high" label="Error" />`.

**Per-file test update.** Each panel's existing test that asserts the error appears must be extended to assert the badge appears alongside it. If a panel lacks an error-state test, add one.

**Commit per panel.** Six commits, one per file, each with message `fix(45-be): pair <Panel> error paragraph with severity badge`. Per-file commits keep blame legible and let reviewers cross-check the i18n / label choice in isolation.

### §5 Verification

Before `gh pr ready`:

1. `wc -l app/src/ui/AppCurrentPane.tsx` ≤ 120.
2. `npm run typecheck && npm run lint && npm run test:coverage` — all green.
3. `npx playwright test tests/e2e/a11y.spec.ts` — all green (color-contrast gate).
4. `gh pr checks <pr>` — all green, no pending.
5. Codex adversarial gate clean or every must-fix logged.

### §6 Risk register

- **Aria-landmark regression** — guarded by the BE-1.4 inventory test plus the per-region tests.
- **Prop drilling explosion** — `SupportingContext` accepts ~9 props; acceptable trade for keeping coordinator slim. If it grows past 12, fold into a single `supporting` object prop in a follow-up; do not over-engineer here.
- **`<Badge severity="info">` vs `<Badge severity="high">` mislabeling** — reviewed in Codex pass; the inline guidance "Requires a signed pack to share" is informational, not an error, so info is correct.

### §7 Out-of-band notes

- No telemetry change.
- No i18n key change (existing translations re-used).
- No public types added or removed.
