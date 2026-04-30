# Wave 51 — Marginalia design integration

**Goal.** Land the Claude Design handoff
(`claude_design_handoff_leaseguard/`) as a real information-architecture
shift on top of the Marginalia tokens already in
`app/src/index.css`. The end state: a parsed-text reading surface with
inline severity highlights and a margin column of finding cards, a
scholarly-footnote finding detail modal, a slim header with
offline-on-device chrome, an annotated upload landing, a staged loader,
and a new 5th "Settings" tab that absorbs every non-reading control.
After this wave, the Current tab reads like a marked-up page from a
book; the PDF canvas is one click away when needed; and pack
management, locale, theme, signing, archive, and the privacy disclosure
all live in one settings home.

**Architecture.** Six sequenced parts on one feature branch, each
landed direct (not parallel-dispatched). Order matters because Part A
adds the Settings tab that unblocks Part B's slim header.

- **Part A — Settings tab scaffold.** Add `'settings'` to `AppViewMode`,
  wire a 5th tab, lift `AppLibraryAndPacksPane` + `AppFooterControls` +
  `LocalePickerPanel` + `ThemeToggle` + the privacy `<details>` under it.
- **Part B — Slim header + landing + loader.** Reduce `AppHeader` to
  wordmark / filename / tab pills / offline-dot / "New lease" reset.
  New `UploadView` for the upload state. New `LoadingView` staged
  ticker driven off `usePipeline`.
- **Part C — Marginalia reader + finding rail + reader/PDF toggle.**
  New `MarginaliaReader` (parsed-text page with margin column), new
  `FindingRail` (28px severity heatmap), new in-tab toggle so PdfViewer
  is one click away. Shared selected-finding state.
- **Part D — Scholarly-footnote detail modal.** New `FindingDetailModal`
  replacing the inline `SelectedFindingCard`. Preserves
  apply-suggestion + save-as-counter + promote-to-standard hooks.
- **Part E — FindingsPanel restyle.** Display header ("N worth a closer
  look"), severity chips with counts, glossary popover restyle of
  `highlightDefinedTerms`. Preserve category filters, collapsibles,
  hybrid LLM badge, search/`/`-focus.
- **Part F — Portfolio / Redline / Audit restyles.** Card-grid portfolio
  wired to real data, side-by-side redline diff routing to existing
  exports, mono-table audit log.

**Tech Stack.** Vite 5, React 18, Tailwind v4 with the existing
`@theme` tokens, vitest + RTL + axe, Storybook 8 CSF. No new npm
dependencies. No CSP changes (handoff's web-font CDN imports are
already covered by the locally-hosted Source Serif 4).

**Base SHA.** `origin/main` at `80ec6ce` (DESIGN.md refresh, #183).
Verify `git fetch origin && git log origin/main --oneline -1` matches
before branching.

**Prerequisites.** Phase 20 backlog rows in `docs/BACKLOG.md` settled
(decisions block). No prior wave gates; Wave 50 (perf pipeline fix) is
content-independent.

---

## §1 Hard rules

1. **One PR per part, sequenced.** Six PRs on `wave51-marginalia-{a..f}`
   feature branches, each rebased on the previous after merge. Parts A
   and B can ship in either order if the slim-header drop targets
   already exist; everything else is strictly sequential because each
   later part edits files the earlier parts moved.
2. **No new dependencies.** Reuse existing Tailwind tokens, Source
   Serif 4 self-host, and the `Card` / `Badge` system primitives.
3. **No new color tokens.** The handoff uses the same palette already
   in `app/src/index.css`. If a component reaches for a hex literal,
   replace it with the matching `--color-*` token before merge.
4. **No-side-stripe policy stays green.** Margin notes use a 1px
   hairline + tinted background, not a 2px `borderLeft`. Update
   `app/src/test/no-side-stripe.policy.test.ts` only if a new
   `<Card variant="severity-…">` row variant is added; do not relax it.
5. **Aria inventory preserved verbatim.** `AppHeader.tsx`,
   `AppCurrentPane.tsx`, `FindingsPanel.tsx` all carry top-of-file
   "Aria/data inventory" comments. Every label / role / id called out
   there must survive the restyle. Tests that probe them (e.g.
   `App.panels.test.tsx`, `FindingsPanel.a11y.test.tsx`) stay green.
6. **i18n discipline.** New user-visible strings flow through the
   `useI18n` hook + `i18n/messages/*.json`. No raw English in JSX
   except brand names (LeaseGuard) and severity codes.
7. **Glossary popover must be keyboard-accessible.** Hover OR focus
   opens; Esc closes; `aria-describedby` ties trigger to popover.
8. **Detail modal is a real `<dialog>` or aria-modal-equivalent.**
   Focus trap on open, restore-focus on close, Esc dismisses, click
   outside dismisses. Reuse existing focus-trap helper if present;
   otherwise port the OnboardingTour pattern.
9. **Reader/PDF toggle persists per-session, not per-lease.** A
   single boolean in component state is enough; don't write to IDB.
10. **Local gate green** (`npm run typecheck && npm run lint &&
    npm run test:coverage`) before push, every part. Coverage floor
    holds at the post-Wave-43 thresholds (96/90/93/96).
11. **`gh pr ready` only when CI is green.** Per CLAUDE.md.
12. **Codex adversarial gate** runs on Parts C and D (the
    reading-surface and modal — net-new code in security-adjacent
    audit-log + apply-redline hooks). Parts A, B, E, F are restyles +
    reorganization and skip the gate.

## §2 Out of scope

- **Tweaks panel** from the handoff. It's a Claude Design live-preview
  artifact and ships nothing.
- **Mock portfolio data.** `PORTFOLIO_LEASES` from `portfolio-view.jsx`
  is a stage prop; the wired portfolio reads from
  `listAllLeaseRecords()` only.
- **Redline-PDF export.** The handoff's "Export PDF" button routes to
  the existing signed-JSON / HTML export paths; no new pipeline.
- **Marginalia reader as a first-class document model.** This wave
  renders existing `LeaseDocument.paragraphs` — no new parser fields,
  no `paragraph.kind = "title" | "h2" | "meta" | body` rework. If the
  parser doesn't already emit these kinds, fall back to plain body
  rendering and file a follow-up.
- **PDF replacement.** PdfViewer stays in the codebase; only its
  default-tab status changes.
- **Performance regression budget moves.** Existing `check:budget`
  thresholds hold; if `MarginaliaReader` blows the app shell budget,
  lazy-load it the way `AppRedlinePane` lazy-loads.
- **Removal of `AppFooterControls`.** Its body folds into the Settings
  tab; the component file is deleted in Part A's same commit.

## §3 Plan body — Part A (Settings tab scaffold)

**Files touched:**

- `app/src/ui/AppHeader.tsx` — extend `AppViewMode` with `'settings'`,
  add a 5th tab pill (no styling change yet).
- `app/src/App.tsx` — add `viewmode-panel-settings` panel; mount new
  `AppSettingsPane`.
- `app/src/ui/AppSettingsPane.tsx` (NEW) — wraps `LocalePickerPanel`,
  `ThemeToggle`, the privacy `<details>` block lifted from
  `AppHeader.tsx`, `AppLibraryAndPacksPane`, and the encrypted-archive
  + clear-all controls lifted from `AppFooterControls`.
- `app/src/ui/AppSettingsPane.test.tsx` + `.stories.tsx` (NEW).
- `app/src/ui/AppFooterControls.tsx` — DELETED. Callers in `App.tsx`
  switch to invoking the same flows from inside `AppSettingsPane`.
- `app/src/ui/AppHeader.test.tsx` — update tab-list assertion to
  expect 5 tabs.
- `app/src/App.panels.test.tsx` — extend the "every panel renders"
  fixture with the new Settings panel.
- `app/src/i18n/messages/en.json` — add `header.view.settings`.

**Verify:**

- `npm run test -- AppSettingsPane` — green.
- `npm run test -- AppHeader` — 5-tab assertion passes.
- `npm run test -- App.panels` — Settings panel mounts and contains
  the lifted controls.
- Browser walk: open dev server, click Settings tab, confirm pack
  manager + locale picker + theme toggle + privacy disclosure +
  encrypted-archive + clear-all all reachable; confirm no controls
  duplicated in header or footer.

## §4 Plan body — Part B (Slim header + landing + loader)

**Files touched:**

- `app/src/ui/AppHeader.tsx` — strip privacy `<details>`,
  `LocalePickerPanel`, `ThemeToggle`, the file-input upload control,
  and the visible "Try sample" button. Keep wordmark, filename
  (when analyzed), tab pills, `OfflineDot` (port from
  `app-shell.jsx`), "New lease" reset (when analyzed). Aria inventory
  retained.
- `app/src/ui/OfflineDot.tsx` (NEW) — small status pill.
- `app/src/ui/UploadView.tsx` (NEW) — annotated headline + drop zone
  + "what you'll see" sample column + footer chips. Source:
  `app-shell.jsx` `UploadView`. Replaces the `status.kind === 'idle'`
  branch in `AppCurrentPane`.
- `app/src/ui/LoadingView.tsx` (NEW) — staged ticker. Subscribes to
  `usePipeline`'s lifecycle: `parse-start` → `parse-done` →
  `analyze-start` → `analyze-done`. The handoff's `setTimeout`
  cascade is replaced by real pipeline events; if pipeline doesn't
  yet emit them, add a small `usePipeline.subscribe()` enum.
- `app/src/App/usePipeline.ts` — extend with optional lifecycle
  callback param `onStage(stage: 'parse' | 'analyze' | …)`.
- `app/src/ui/AppCurrentPane.tsx` — render `<UploadView>` when
  `status.kind === 'idle'`; `<LoadingView>` when `'loading'`.
- Tests + stories for `UploadView` / `LoadingView` / `OfflineDot`.

**Verify:**

- `npm run test -- UploadView LoadingView OfflineDot AppHeader` —
  green.
- Browser walk: cold load → annotated headline; click "Drop a PDF" →
  staged loader rolls through 4–5 stages → analyzed view; click
  "New lease" → returns to landing.

## §5 Plan body — Part C (Marginalia reader + rail + toggle)

**Files touched:**

- `app/src/ui/MarginaliaReader.tsx` (NEW) — paragraph rendering with
  inline `<mark>` highlights, margin-note column, scroll-to-active
  via `data-finding-id`. Source: `document-pane.jsx`.
- `app/src/ui/FindingRail.tsx` (NEW) — 28px vertical heatmap.
  Source: `app-main.jsx` `FindingRail`.
- `app/src/ui/AppCurrentPane.tsx` — replace the `<PdfViewer>` mount
  with a `<ReaderPdfToggle>` that swaps between `MarginaliaReader`
  (default) and `PdfViewer`. `FindingRail` mounts to the left.
- `app/src/ui/ReaderPdfToggle.tsx` (NEW) — small segmented control;
  state lives in `AppCurrentPane`.
- Tests + stories for the three new components. The reader's
  scroll-to-active behavior gets a dedicated test using
  `IntersectionObserver` shim from existing test setup.
- Lazy-load `MarginaliaReader` if app-shell budget would otherwise
  trip; mirror the `AppRedlinePane` lazy pattern.

**Adversarial gate.** Run `/codex-adversarial-gate` against Part C's
diff before opening the PR for review. The reader's inline
`<mark>` rendering shares text with `applySuggestion` redline writes;
Codex should confirm no cross-leak between read-only render path and
mutation path.

**Verify:**

- `npm run test -- MarginaliaReader FindingRail ReaderPdfToggle` —
  green.
- `npm run test -- AppCurrentPane` — reader-default assertion + PDF
  toggle assertion green.
- Browser walk: analyzed lease → marginalia reader is default, margin
  notes line up to paragraphs, click rail cell jumps to paragraph,
  click PDF toggle swaps in PdfViewer with same selected finding.

## §6 Plan body — Part D (Scholarly-footnote detail modal)

**Files touched:**

- `app/src/ui/FindingDetailModal.tsx` (NEW) — two-pane modal. Source:
  `findings-panel.jsx` `FindingDetail`. Wraps existing
  apply-suggestion + save-as-counter + promote-to-standard callbacks.
- `app/src/ui/AppCurrentPane.tsx` — replace
  `<SelectedFindingCard>` with `<FindingDetailModal open={…}>`.
- `app/src/ui/AppCurrentPane/SelectedFindingCard.tsx` — DELETED (or
  kept as a fallback if any non-modal path needs it; default is
  delete).
- Focus trap utility — port from `OnboardingTour` if not already
  shared, otherwise inline in the modal.
- Test + story.

**Adversarial gate.** Run `/codex-adversarial-gate` on Part D —
the modal's apply-suggestion path writes to `redline` + audit log;
Codex should confirm the focus-trap doesn't suppress audit failures
and that Esc-close cancels in-flight applies cleanly.

**Verify:**

- `npm run test -- FindingDetailModal` — green.
- `npm run test -- AppCurrentPane` — modal-open / Esc-close /
  focus-restore assertions green.
- `npm run test -- FindingsPanel.feedback` — apply-suggestion path
  still fires through the modal.
- Browser walk: click finding → modal opens with clause-as-page on
  left, footnote on right; prev/next nav works; "Apply to redline"
  swaps to applied state; Esc closes and returns focus to the
  finding row.

## §7 Plan body — Part E (FindingsPanel restyle + glossary popover)

**Files touched:**

- `app/src/ui/FindingsPanel.tsx` — restyle header ("N worth a closer
  look" display + chip row with counts). Preserve all existing
  controls, ids, aria.
- `app/src/ui/highlightDefinedTerms.tsx` — restyle popover to match
  `GlossaryTip` from `document-pane.jsx`. Add keyboard-open path.
- `app/src/ui/FindingsPanel.test.tsx` + variants — update header
  copy / structure assertions.
- `app/src/ui/highlightDefinedTerms.test.tsx` — keyboard-open
  assertion added.

**Verify:**

- `npm run test -- FindingsPanel` — all 7 sub-suites green.
- `npm run test -- highlightDefinedTerms` — green incl. keyboard.
- Browser walk: open analyzed lease, hover a defined term in the
  reader → dark-card popover; tab to a term and confirm focus opens
  the same popover.

## §8 Plan body — Part F (Portfolio / Redline / Audit restyles)

**Files touched:**

- `app/src/ui/PortfolioPanel.tsx` — card-grid layout + mini severity
  heatmap + totals strip. Wire to existing
  `findingsByLease` map; do not import the handoff's hard-coded
  `PORTFOLIO_LEASES`.
- `app/src/ui/AppRedlinePane.tsx` — side-by-side diff layout +
  apply-all / clear-all / per-finding chip toggles. Export buttons
  route to existing `exportFindingsAsHtml` and signed-JSON paths;
  no new redline-PDF code.
- `app/src/ui/AuditLogPanel.tsx` — mono 4-column table layout +
  Merkle-root / public-key footer. Verify-chain + download buttons
  preserved.
- Stories + test snapshot updates as needed.

**Verify:**

- `npm run test -- PortfolioPanel AppRedlinePane AuditLogPanel` —
  green.
- `npm run test:coverage` — overall thresholds hold.
- Browser walk: portfolio shows real leases as cards, redline view
  has working apply/clear chips, audit log table aligns and
  Verify-chain still works.

## §9 Closeout

- [ ] All six PRs merged.
- [ ] `claude_design_handoff_leaseguard/` archived under
      `docs/design-archives/marginalia-handoff-2026-04-29/` (or
      deleted, owner's call).
- [ ] `docs/BACKLOG.md` Phase 20 rows promoted to §7 Done.
- [ ] `DESIGN.md` updated with the marginalia reader + finding rail +
      footnote modal as canonical components.
- [ ] Memory entry: `feedback_marginalia_default.md` capturing the
      "marginalia reader is the default reading surface; PdfViewer is
      a toggle" decision so future agents don't re-litigate it.
- [ ] Lighthouse a11y score still ≥ 0.95; axe story sweep still 0
      serious/critical.

## §10 Risk register

- **R1 — Reader scroll-to-active conflicts with the rail's
  click-to-jump.** Both write to scroll position. Mitigation: rail
  click sets `activeFinding`, then the reader's existing
  `useEffect([activeFinding])` scroll handler runs once. No second
  scroll source.
- **R2 — Detail modal interrupts the side-by-side flow when the user
  has switched to the PDF tab.** Mitigation: modal still opens; PDF
  view re-renders behind it. If the modal's clause-as-page duplicates
  what's already visible in the PDF, that's intentional context
  pinning.
- **R3 — Removing `AppFooterControls` breaks any test that imports
  it.** Mitigation: grep before deletion; `App.panels.test.tsx`
  exercises clear-all via real DOM, will need a Settings-tab
  navigation step.
- **R4 — `usePipeline.subscribe()` API is overkill if pipeline events
  already exist.** Audit `usePipeline.ts` first; if a status-machine
  state already drives the existing `<p>Analyzing…</p>` line, just
  read those state transitions instead of adding a subscribe API.
- **R5 — Glossary popover keyboard-open conflicts with the existing
  `/`-focus-search global handler.** Mitigation: popover uses
  `aria-describedby` not a focus-trap; `/` keypress still focuses the
  findings search.
