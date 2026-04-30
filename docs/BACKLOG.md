# Backlog

Concrete, shippable stories mapped to `ROADMAP.md`. Each `[ ]` item is small
enough to land in one PR.

## Status legend

| Mark  | Meaning                                                 |
| ----- | ------------------------------------------------------- |
| `[x]` | Done and in `main`                                      |
| `[~]` | Partial — scope cut with a note; follow-up ticket below |
| `[ ]` | Not started                                             |
| `!`   | Blocker (no blockers at time of writing)                |

## Current footprint

| Axis         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Gate                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Source       | ~181 non-test files + ~187 test files; 7 Playwright specs in `tests/e2e/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `find app/src -name '*.ts' -o -name '*.tsx'` |
| Tests        | ~1367 passing (app, post-Wave-43) + 8 in `cli/` + 6 e2e (chromium) + 1 gated real-model spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `npm test`                                   |
| Coverage     | thresholds **96 / 90 / 93 / 96** (post-Wave-43 ratchet); see `docs/TESTING.md` for current actuals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `npm run test:coverage`                      |
| Bundles      | app shell ~290 KiB (`index-*.js` + split) · pdf.js api 400 KiB · pdf.worker 1.3 MiB · leaseWorker ~8 KiB · tesseract runtime 8 MiB (opt-in)                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `npm run check:budget`                       |
| IndexedDB    | main `leaseguard` **v5** (`leases` + `settings` + `clauseTemplates` + `paragraphShingles`, post Wave 10-B); 9 side dbs: `leaseguard-packs` v3 (`signatures` store), `leaseguard-annotations` v1, `leaseguard-counters` v1, `leaseguard-signing` **v2** (multi-key, post Wave 8-D), `leaseguard-audit` v1 (entries gain optional `signedByKeyId`), `leaseguard-redlines` v1, `leaseguard-versions` v1, `leaseguard-bulk-dedup` v1, `leaseguard-standards` **v1** (Wave 10-C). `leaseguard-packs` `settings` store also gains a `severityOverridesByLease` key (Wave 10-D) without a schema bump. | migrations tested                            |
| App.tsx      | 12 hooks under `src/App/use*.ts` (Wave 7-D + Waves 17-21 follow-ups); 5 sub-components extracted (`AppHeader`, `AppRedlinePane`, `AppFooterControls`, `AppCurrentPane`, `AppLibraryAndPacksPane`); App.tsx **569 lines** (below the ~600 target)                                                                                                                                                                                                                                                                                                                                                | —                                            |
| CLI          | `leaseguard-verify` (Node, no browser, no network) — `cli/` workspace, 3 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `cd cli && npm test`                         |
| Build        | Vite 5 + vite-plugin-pwa → `dist/` with `sw.js`; Web Worker chunk for parse+analyze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `npm run build`                              |
| Lint / types | `tsc -b --noEmit` + ESLint clean (0 warnings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `npm run typecheck && npm run lint`          |

Rough size context: the PWA ships ~2 MB precache without OCR; +8 MB runtime
and +10 MB of language data once `eng.traineddata.gz` is dropped into
`public/tesseract/`.

---

## Phase 0 — Foundations

- [x] Scaffold Vite + React + TS app in `app/`
- [x] Strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`)
- [x] ESLint + Prettier
- [x] Vitest wired; `npm run test:coverage` with thresholds in CI
- [ ] Pre-commit hook (`lint-staged`) — opt-in; CI is authoritative
- [x] Playwright smoke test. Landed chromium-only in Wave 12 Part B
      (`tests/e2e/golden.spec.ts`); extended to a 3-way `chromium` /
      `firefox` / `webkit` matrix in Wave 14 Part B
      (`playwright.config.ts` + `.github/workflows/e2e.yml`).
- [x] CSP `default-src 'self'` + local pdf.worker + no-CDN contract
- [x] GitHub Actions: typecheck + lint + coverage on PR
- [x] Bundled synthetic fixtures (residential + commercial leases via pdf-lib)

## Phase 1 — PDF Parser

- [x] `pdfjs-dist` integrated, worker bundled locally
- [x] `extractPages(bytes) → PageText[]` with positions + fontSize
- [x] Paragraph reconstruction (line joining, hyphen repair, header/footer strip)
- [x] Heading/section detection (numbered + ALL CAPS heuristics; preamble fallback)
- [x] `LeaseDocument` type + `parseLease(bytes)` top-level entry
- [x] Golden-file tests (synthetic residential + commercial)
- [x] Real scanned-PDF fixture (detection works via `needsOcr`; image-only PDF synthesized in-memory by `app/scripts/build-scanned-fixture.mjs` and exercised end-to-end through `parseLease` in `src/compare/needsOcr.test.ts` — no binary committed, sub-ms build step)
- [x] 50-page perf budget test (~210ms in CI, budget 3s)
- [x] Password-protected PDF → `PasswordProtectedPdfError`

## Phase 2 — Rules Engine

- [x] `Rule` + `Finding` types, matcher union (regex / keywordProximity / sectionAnchored)
- [x] `analyze(doc, rules)` with stable ordering + negation post-filter
- [x] Rule pack v1 (10 rules)
- [x] Per-rule positive + benign negative tests
- [x] Confidence scoring (regex 0.9, proximity 0.75, ×0.5 when negated)
- [x] Rule pack versioning stamped on every finding

## Phase 3 — UI

- [x] Upload control (PDF-only) + sample-lease button
- [x] Findings panel: severity groups, empty state, negation badge
- [x] Click finding → selected article, scroll-to-page in viewer
- [x] Search-within-findings (title/explanation/snippet)
- [x] Severity + category filter chips
- [x] Collapsible severity sections
- [x] Cmd/Ctrl-F and "/" focus the findings search
- [x] Keyboard nav (↑/↓/Enter) across finding buttons
- [x] Loading / empty / parse-error states
- [x] PDF viewer canvas per page via pdf.js
- [x] Span-level highlight overlay (paragraph bbox + absolute div over canvas)
- [x] Full a11y audit gate — `app/src/ui/FindingsPanel.a11y.test.tsx`
      runs `vitest-axe` on the most aria-heavy panel; `tests/e2e/a11y.spec.ts`
      runs `@axe-core/playwright` against the analyzed-lease view with
      `wcag2a` + `wcag2aa` tags and fails on any serious/critical
      violation. Manual screen-reader walkthrough remains a deferred
      follow-up — see `docs/TESTING.md` "a11y gate" (2026-04-25).

## Phase 4 — Local Storage

- [x] IndexedDB wrapper (idb), versioned schema (v1 leases → v2 settings → v3 clauseTemplates); cumulative `if (oldVersion < N)` migration gates
- [x] Save + list + open + rename + delete
- [x] Standard-lease pointer + auto-compare on upload
- [x] JSON export (schema `leaseguard.findings.v1`)
- [x] Printable HTML export (`@media print`, XSS-escaped)
- [x] Encrypted archive export/import (AES-GCM + PBKDF2, `LGv1` magic)
- [x] Clear-all with confirmation
- [x] Clause-template CRUD (see Phase 5)

## Phase 5 — V2: Compare & OCR

- [x] Rule-aware findings diff (added/removed/changed/unchanged)
- [x] Paragraph-level `diffLeases` with fuzzy Levenshtein matching (threshold 0.6; adds "changed" status with previousText)
- [x] Compare picker + ComparePanel UI
- [x] `needsOcr` heuristic + warning banner
- [x] Tesseract.js OCR engine — opt-in "Attempt OCR" button on the
      needsOcr banner; tesseract.js is lazy-imported so non-OCR users skip
      the ~8 MB runtime. Assets served same-origin from `/tesseract/` to
      satisfy CSP (`build:tesseract-assets` script copies worker + core wasm
      at postinstall). `eng.traineddata.gz` (~10 MB) is a one-time manual
      drop into `public/tesseract/`; Workbox precaches everything so offline
      OCR works, at a cost of ~18 MB to the offline download.
- [x] Per-clause "my standard" template library

## Phase 6 — Polish & Distribution

- [x] 50-page perf guard in test run
- [x] PWA manifest + autoUpdate service worker (vite-plugin-pwa)
- [x] Privacy disclosure `<details>` block + not-legal-advice disclaimer
- [x] SVG app icon + favicon link
- [x] Side-by-side CSS layout (stacks below 960px)
- [x] Lighthouse a11y + PWA scores ≥ 95 in CI — enforced via
      `app/lighthouserc.json` (`categories:accessibility ≥ 0.95`,
      `installable-manifest`, `apple-touch-icon`); `npm run lhci`
      runs in `.github/workflows/ci.yml` (2026-04-25).
- [x] Tauri desktop wrapper scaffold committed (`app/src-tauri/`); CI
      builds on Linux (`.deb`), macOS (`.app` + `.dmg`), and Windows
      (`.msi`) per `.github/workflows/tauri.yml`. Artifacts upload per
      OS on every PR. Decision: closed — the CI matrix is the gate;
      code-signing / notarization tracked separately in the risk
      register (2026-04-25).
- [ ] Onboarding tour (sample lease button exists; full walkthrough pending)

## Phase 7 — Observability & hygiene

Local-only, CSP-compatible.

- [x] Error boundary with in-memory crash log (ring buffer, capacity 20)
- [x] "Download diagnostics" JSON export (schema `leaseguard.diagnostics.v1`)
- [x] Bundle-size budget in CI via `scripts/check-bundle-budget.mjs`
- [x] Rule-authoring guide (`docs/RULES.md`) with matcher cookbook
- [x] Storybook scaffold + stories for all UI components
- [x] Code-split pdf.worker via dynamic import (`loadPdfjs` in `renderPdfPages.ts` uses `await import(...)`; app shell is 197 KiB, pdf.worker is a separate 1.3 MB chunk loaded on first PDF parse)

## Phase 8 — Structured lease understanding

- [x] Table detection: cluster text items into row/column grids when
      y-alignment + x-column consistency exceed a threshold; emit
      `Table { rows: Cell[][], page, bbox }` model. Shipped in phase8b
      at `src/parser/tables.ts`.
- [x] Rent-schedule extraction as the first use case; typed
      `RentSchedulePeriod[]` (from/to dates, amount, escalator). Shipped
      in phase8b at `src/facts/rentSchedule.ts`; consumed by
      `extractLeaseFacts`.
- [x] Definition detection: regex anchors for `"X" shall mean Y` /
      `X means Y`; populated as `DefinitionEntry[]`
      (term / definition / page / paragraphIndex) by
      `src/facts/extractFacts.ts`.
- [x] Cross-reference resolver: find `\bSection \d+(\.\d+)*\b`,
      `\bExhibit [A-Z]\b`, `\bSchedule \d+\b`; emitted as
      `CrossReference[]` with namespaced `target`
      (`section:` / `exhibit:` / `schedule:`).
- [x] `LeaseFacts` object: base rent, deposit, term length, notice
      periods, commencement/expiration dates. Pure
      `extractLeaseFacts(doc: LeaseDocument): LeaseFacts`. Rendered by
      the new `LeaseFactsPanel` (populated + empty stories). App wire-up
      landed in `wire-panels`.
- [x] Hover-glossary in the findings panel (tooltip on defined terms).
      Landed in wave 2 (`src/ui/highlightDefinedTerms.ts`); FindingsPanel
      wraps defined terms in its snippet with a tooltip when
      `definitions` prop is supplied.
- [x] Golden tests: a commercial lease fixture exercising table +
      definitions + references simultaneously. Shipped in Wave 29-A
      (PR #TBD): `src/rules/fixtures/commercial-full.ts` + four new
      assertions in `src/rules/golden.test.ts`.
- [x] **Per-span bbox highlighting.** Shipped in Wave 28-A + 28-E.
      Parser now attaches `Paragraph.lines: LineSpan[]` (each line
      keeps its char-offset range + bbox); `PdfViewer` renders one
      highlight rect per overlapping line via `computeSpanRects`,
      with paragraph-bbox fallback for legacy persisted leases.
      Non-breaking — `lines` is optional; legacy leases get the
      Wave 15-C paragraph-rect highlight until re-parsed.

## Phase 9 — Negotiation support

- [x] `Annotation` IndexedDB store (keyed by leaseId+paragraphIndex);
      add/edit/delete UI anchored to the findings panel.
      `src/annotations/annotations.ts` + `src/ui/AnnotationsPanel.tsx`;
      App wire-up landed in `wire-panels`.
- [x] Redline edit mode: per-paragraph editor with word-level LCS diff,
      stored separately from the original. Landed in wave3-redline as
      `src/redline/redline.ts` + `src/redline/redlineStorage.ts` +
      `src/ui/RedlinePanel.tsx`; App wire-up landed in `wave3-wireup`
      as a third view-toggle option next to Current / Portfolio.
- [x] Export redlined HTML with `<ins>`/`<del>` tags + print stylesheet.
      `buildRedlineHtml` in `src/redline/redline.ts`; App wire-up in
      `wave3-wireup` downloads the blob from the RedlinePanel export
      button.
- [x] Counter-offer library (extends Phase 5 clause templates):
      per-rule "suggested replacement" field, editable per user.
      `src/negotiation/counterOffers.ts` + `src/ui/CounterOfferPanel.tsx`;
      App wire-up landed in `wire-panels`.
- [x] "Apply suggestion" button on a finding → inserts template text
      into the redline mode as a proposed change. Landed in
      wave3-redline — FindingsPanel renders the button when a
      `suggestedTextByRuleId` entry exists for the finding's ruleId.
      `wave3-wireup` builds that map from saved counter-offers
      (preferred) with fallback to `rule.suggestedEdit`, writes a
      ruleId-tagged `RedlineEdit`, and switches the active view to
      Redline.
- [x] Version history: each save of a redlined doc creates a new
      snapshot in a dedicated `leaseguard-versions` IndexedDB; navigate
      versions with a timeline. Landed wave 4 as
      `src/negotiation/versionHistory.ts` +
      `src/ui/VersionHistoryPanel.tsx`; App wire-up in `wave4-wireup`
      mounts the panel below RedlinePanel with create/restore/export/
      delete handlers + audit-log entries.
- [x] Side-letter generator: given a set of proposed edits, produce a
      numbered, printable letter with section citations. Landed wave 4
      as `src/negotiation/sideLetter.ts` + `src/ui/SideLetterPanel.tsx`;
      App wire-up in `wave4-wireup` uses `doc.sections` to resolve
      paragraph → section labels and provides preview (popup window with
      download fallback) + download actions.
- [ ] Side-letter: add PDF export alongside the HTML artifact (today
      `buildSideLetterHtml` is the only renderer). Likely path: re-use
      the redlined-HTML print stylesheet + a canvas-to-PDF pass (or a
      tiny hand-rolled PDF writer in the spirit of `buildHandoffZip`).
- [ ] Side-letter preview: replace the popup-window preview with an
      inline iframe. Popup blockers silently trip the current fallback
      ladder (`App.tsx` ~line 979), so users can't preview without
      allow-listing. Inline iframe keeps the fallback for a known-good
      path.

## Phase 10 — Rule ecosystem

- [x] JSON Schema for rule packs (`leaseguard.rulepack.v1`). Validate
      on import, reject malformed. Implemented as a hand-rolled
      validator in `src/rules/packSchema.ts` (no ajv dep); covers
      matcher-type / severity / category enums + regex compileability.
      Diff-vs-currently-loaded UI shipped as `PackDiffPanel` in
      wave2-jurisdictionUi; App wire-up lands in wave2-wireup.
- [x] Import/export UI: list installed packs; disable/enable per
      pack; accept `.lgpack.json`. Implemented in
      `src/ui/PackManagerPanel.tsx`, backed by
      `src/rules/packStorage.ts` (separate `leaseguard-packs`
      IndexedDB database). App wire-up landed in `wire-panels`; enabled
      packs now feed `resolveActiveRules` and drive both upload and OCR
      analysis paths. Drag-and-drop and export-to-disk still open.
- [x] Custom-rule authoring UI: form-driven matcher builder with live
      "does this fire on the current lease?" preview. Landed in
      wave3-customRule as `src/ui/CustomRuleBuilderPanel.tsx` +
      `src/ui/customRuleDraft.ts` (regex / keywordProximity /
      sectionAnchored with live hit-count, duplicate-id guard, regex
      compile-error surfacing). App wire-up in `wave3-wireup` wraps
      the saved rule as a minimal `.lgpack.json` (`custom-<ruleId>`),
      auto-enables it, and re-analyzes the current lease.
- [x] `Rule.jurisdictions?: string[]` field (ISO-like codes, e.g.
      `"US-CA"`). UI jurisdiction picker; runtime filter. Shipped in
      phase10b — type lives in `src/rules/types.ts`, filter in
      `src/rules/jurisdictions.ts`, picker in
      `src/ui/JurisdictionPickerPanel.tsx`. App wire-up lands in
      wave2-wireup.
- [x] Per-user severity overrides persisted in settings. Shipped in
      phase10b — persistence via
      `packStorage.getSeverityOverrides()` /
      `setSeverityOverride()`, override application in
      `src/rules/severityOverrides.ts`, UI in
      `src/ui/SeverityOverridesPanel.tsx`.
- [x] Ed25519 signature support via WebCrypto; "verified" vs
      "community" badge in the pack list. Landed wave 4 as
      `src/rules/packSigning.ts` (signPack / verifySignedPack) +
      `saveSignedPack` / `getPackSignatureStatus` in
      `src/rules/packStorage.ts` (new `signatures` store, DB v3). Panel
      badge in `src/ui/PackManagerPanel.tsx`; App wire-up in
      `wave4-wireup` detects signed envelopes at import, routes them
      through `saveSignedPack`, and surfaces `verified` / `invalid` /
      `community` on the PackManagerPanel.
- [~] Bundle a small offline marketplace of curated packs as static
  JSON under `/public/packs/`. Seeded with
  `example-starter.lgpack.json` produced by
  `app/scripts/build-example-pack.mjs`; full curated marketplace
  still open.
- [ ] Marketplace UI: surface `public/packs/*.lgpack.json` in
      `PackManagerPanel` with a "Browse included packs" list +
      one-click install. Today the seed pack exists on disk but has no
      in-app entry point.

## Phase 11 — Workflow & integrations

- [x] `.ics` export — pure `buildIcs({leaseName, dates})` primitive
      landed in `src/workflow/buildIcs.ts` (RFC 5545, 75-octet folding,
      escape handling, all-day events). `LeaseFacts` → `IcsDateInput[]`
      adapter + App wire-up landed in `wire-panels`.
- [x] "Copy summary" button → HTML + plain-text to the clipboard via
      `navigator.clipboard.write` + `ClipboardItem`, with `writeText`
      fallback. `buildSummary` + `copyToClipboard` in
      `src/workflow/copySummary.ts`.
- [x] Lawyer handoff ZIP: original PDF + HTML report + JSON + readme,
      bundled via a hand-rolled STORE-only ZIP writer
      (`src/workflow/buildHandoffZip.ts`). No new deps.
- [x] Portfolio view: grid of leases across the library with counts
      per rule id; filterable. `src/ui/PortfolioPanel.tsx` mounted
      behind a Current-lease / Portfolio view toggle in `wire-panels`.
- [x] Bulk import: multi-file PDF upload with progress bar, per-file
      status, and content-hash dedup via `leaseguard-bulk-dedup` IDB.
      Primitive in `src/workflow/bulkImport.ts`; panel in
      `src/ui/BulkImportPanel.tsx`; App wire-up at
      `App.tsx#onBulkImportFiles` (wave2-wireup). Zip/folder drop still
      open (see Phase 11 follow-up ticket below).
- [x] `WorkflowPanel` UI primitive (`src/ui/WorkflowPanel.tsx` +
      stories) with three action buttons and status. App wire-up landed
      in `wire-panels`.
- [ ] Bulk import: accept a zipped folder of PDFs (extend the existing
      multi-file path). Today users must multi-select PDFs from the file
      picker. Also: `bulkImport.test.ts` is flaky on IDB teardown under
      Vitest parallelism — add an explicit `beforeEach` `deleteDatabase`
      step keyed on a fresh test-scoped DB name.

## Phase 12 — Trust & verification

- [x] `reproducibility.test.ts`: run `analyze` N times over the same
      fixture, assert byte-identical output. (Confirmed already
      deterministic; test uses synthetic residential + commercial PDF
      fixtures with N=3.)
- [x] Signing keypair: generate + store via WebCrypto, unlocked with a
      passphrase (reuse the archive-export passphrase pattern).
      Ed25519; private key PBKDF2+AES-GCM-wrapped in a separate
      `leaseguard-signing` IndexedDB. Lives at
      `src/security/signingKeys.ts` (alongside `inputHash.ts`).
- [x] Signed JSON export: add `signature` field; include `inputHash`
      (SHA-256 of the PDF), `rulePackVersion`, `findings`. Schema pinned
      at `leaseguard.findings.v1`; `signature` is an optional extension.
      `src/storage/exportReport.ts` emits the envelope; SigningKeyPanel +
      gated "Export findings (signed JSON)" button landed in
      `wire-panels`.
- [x] Append-only audit log in IndexedDB; hash-chained entries
      (`prevHash`); "Download audit log" button. Module landed in
      wave2-audit (`src/audit/auditLog.ts`,
      `src/audit/auditExport.ts`); panel (`AuditLogPanel`) + App
      wire-up complete in wave2-wireup.
- [x] Replay bundle export: ZIP with PDF + packs + expected JSON +
      replay script. Landed in wave2-replay
      (`src/workflow/replayBundle.ts`).
- [x] Pack-version pin warning on `diffLeases` when sides disagree.
      Detection shipped wave2-replay; UI rendering landed in
      `wave4-packSigning` (ComparePanel banner driven by
      `packVersionMismatch` prop). App wire-up in `wave4-wireup` threads
      `comparison.a.rulePackVersion` vs `comparison.b.rulePackVersion`
      into the panel.

## Phase 13 — Performance & scale

- [x] Spawn a dedicated Web Worker for `parseLease` + `analyze`; wire
      with `postMessage` + transferable `Uint8Array`. Landed in
      wave3-worker — see `src/worker/` (`leaseWorker.ts`,
      `leaseWorkerClient.ts`, `inlinePipeline.ts`, `handleRequest.ts`).
      `usePipeline` routes uploads through the `PipelineClient`
      abstraction with auto-selection of the Worker-backed client in
      real browsers and an inline fallback for jsdom.
- [x] Streaming render: PdfViewer renders page N as soon as
      `getPage(N)` resolves, rather than waiting on the whole doc.
      Landed in wave6-streaming (PR #1) — `renderPdfPages` is now an
      `AsyncIterable<RenderedPage>` and `PdfViewer` consumes it
      page-by-page so the first page paints as soon as it resolves
      instead of awaiting the full document.
- [x] Virtualized `<ul>` in FindingsPanel using IntersectionObserver.
      Landed wave 4 (`wave4-virtualized`) via `src/ui/useInViewport.ts` + FindingsPanel viewport-gated rendering so long finding lists
      stay cheap to scroll.
- [x] Secondary IndexedDB index on `LeaseRecord.findingCount` +
      `rulePackVersion` so `listLeases` can filter cheaply. Landed
      Wave 7 Part E (`wave7-idb-index`, PR #9) as the v3 → v4
      compound index `BY_FINDING_AND_PACK_INDEX` in
      `src/storage/storage.ts`, with the typed query wrapper
      `src/storage/listLeasesFiltered.ts` covering exact-match,
      `findingCount`-only range, and `rulePackVersion`-only fallback
      paths.
- [x] Compile + cache regex instances at rule-pack import time. Landed
      wave 4 (`wave4-compileRules`) as `src/rules/compileRules.ts` plus
      a two-layer cache in `src/rules/packStorage.ts`
      (`getCompiledRulesForPack` + `getActiveCompiledRules`) so
      `analyze` reuses compiled patterns across renders.
- [x] Perf benchmark grows to 200-page documents; budget scales by
      pages (e.g., ≤ 8s on 200 pages). Landed wave 4 as
      `src/rules/perf.bench.test.ts`.
- [x] `renderPdfPages` accepts an `AbortSignal` rather than returning a
      custom `{done, cancel}` handle (moved from tech debt). Landed in
      wave3-perf — `src/ui/renderPdfPages.ts` + PdfViewer consumer.
- [x] Share a single `copyBytes(bytes): Uint8Array` helper rather than
      inline `new Uint8Array(...)` at every pdf.js hand-off site
      (moved from tech debt). Landed in wave3-perf as
      `src/parser/copyBytes.ts`; consumed by `usePipeline.upload`,
      OCR, and `PdfViewer`.

## Phase 14 — Content depth (optional)

- [x] Per-rule `plainEnglish?: string` field populated at build time
      by the maintainer; UI shows a "What this means" expandable.
      Landed wave 2 — field in `src/rules/types.ts`,
      FindingsPanel renders the disclosure when
      `plainEnglishByRuleId` is provided.
- [x] Per-rule `suggestedEdit?: string` consumed by the Phase 9
      counter-offer flow. Landed wave 2 — field in
      `src/rules/types.ts`; CounterOfferPanel pre-fills its textarea
      with `rule.suggestedEdit` (wave2-wireup).
- [x] Static legal-term glossary at `app/public/glossary/v1.json`,
      surfaced via `src/ui/highlightDefinedTerms.ts` over the existing
      tooltip. Landed Wave 11-A (PR #33).
- [x] i18n scaffold: hand-rolled typed `messages` catalog
      (`src/i18n/messages.ts`) with en baseline + es stub via
      `satisfies Partial<Messages>`; `I18nProvider` wraps `<App>` and
      `LocalePickerPanel` exposes the locale toggle. Landed Wave 11-B
      (PR #34). See "i18n" in `docs/SYSTEM_DESIGN.md`.
- [x] OCR language picker — `discoverOcrLanguages()` lists every
      `*.traineddata.gz` present under `public/tesseract/`;
      `OcrLanguagePickerPanel` lets the user pick before kicking off
      OCR. Landed Wave 11-C (PR #35).

## Wave 7 — Ship-readiness

Plan: [`plans/wave7-ship-readiness.md`](./plans/wave7-ship-readiness.md). Five
parallel-safe parts that close out Phase 6 (Lighthouse CI, Tauri build,
onboarding tour, commercial golden) and clear the two largest cross-cutting
tech-debt rocks (App.tsx decomposition + reanalyze-staleness guard, secondary
IDB index). After Wave 7 lands, no ticket older than Phase 13 should be open.

- [x] Wave 7 Part A — Lighthouse + Tauri CI gates (`wave7-ci-gates`, PR #7)
- [x] Wave 7 Part B — First-run onboarding tour (`wave7-onboarding`, PR #8)
- [x] Wave 7 Part C — Commercial golden fixture (`wave7-golden-commercial`, PR #10)
- [x] Wave 7 Part D — App.tsx decomposition + reanalyze-staleness guard (`wave7-appHooks`, PR #6)
- [x] Wave 7 Part E — Secondary IndexedDB index (`wave7-idb-index`, PR #9)

## Wave 8 — Trust infrastructure (Phase 17)

Plan: [`plans/wave8-trust-infra.md`](./plans/wave8-trust-infra.md). Four
parallel-safe parts that turn the existing trust primitives (signed packs,
signed reports, hash-chained audit log, replay bundles) into an
externally-auditable ecosystem.

- [x] Wave 8 Part A — Offline pack marketplace (`wave8-marketplace`, PR #11)
- [x] Wave 8 Part B — Diff-vs-verified warnings (`wave8-deviation-warnings`, PR #12)
- [x] Wave 8 Part C — Reproducibility CLI (`wave8-cli`, PR #12)
- [x] Wave 8 Part D — Key-rotation workflow (`wave8-key-rotation`, PR #12)

## Wave 9 — Collaboration escape hatches (Phase 15)

Plan: [`plans/wave9-collaboration.md`](./plans/wave9-collaboration.md). Four
parallel-safe parts that turn Wave 8's signing/replay primitives into
shareable workflows: encrypted review archives, signed counter-sign
patches, signed delta packets, and a CLI verifier for the new archive
format.

- [x] Wave 9 Part A — Signed review links (`wave9-review-links`, PR #21)
- [x] Wave 9 Part B — Counter-sign-and-return (`wave9-counter-sign`, PR #20)
- [x] Wave 9 Part C — Delta packets (`wave9-delta-packets`, PR #19)
- [x] Wave 9 Part D — Review-archive CLI verifier + privacy review (`wave9-privacy-review`, PR #22)

## Phase 16 — Multi-lease intelligence

Plan: [`plans/wave10-portfolio-intelligence.md`](./plans/wave10-portfolio-intelligence.md).
Turns the portfolio grid (Phase 11) and per-user severity overrides (Phase 10) into actual analytical leverage across a tenant's library.

- [x] Portfolio-wide rule rollups — `app/src/portfolio/ruleRollups.ts` +
      `PortfolioRollupsPanel` with severity-resolved aggregation and
      drill-through filtering of the existing grid.
- [x] Clause similarity — `shingles.ts` (5-shingles + Jaccard) +
      `clauseClusters.ts` clustering at threshold ≥ 0.8;
      `ClauseSimilarityPanel`. IDB v5 adds the `paragraphShingles`
      store keyed by `[leaseId, paragraphIndex]`.
- [x] "My standard" clause suite — new `leaseguard-standards` v1 IDB,
      `compareToStandard.ts`, `StandardSuitePanel`, additive
      `onPromoteToStandard` callback on `FindingsPanel`. Audit kinds
      `standard-promote` / `standard-delete`.
- [x] Portfolio-scope severity overrides — `portfolioOverrides.ts`
      with lease > portfolio > pack-default resolution; sibling
      `severityOverridesByLease` SETTINGS key (no IDB schema bump);
      "Apply across portfolio" toggle on `SeverityOverridesPanel`.

## Wave 10 — Multi-lease intelligence (Phase 16)

Plan: [`plans/wave10-portfolio-intelligence.md`](./plans/wave10-portfolio-intelligence.md).
Four parallel-safe parts run via TDD dispatch (per-story spec branches +
isolated implementer worktrees).

- [x] Wave 10 Part A — Portfolio rule rollups (`tdd-wave/10/a-rule-rollups`, PR #37)
- [x] Wave 10 Part B — Clause similarity + IDB v5 (`tdd-wave/10/b-clause-similarity`, PR #38)
- [x] Wave 10 Part C — "My standard" clause suite (`tdd-wave/10/c-standard-suite`, PR #39)
- [x] Wave 10 Part D — Portfolio-scope severity overrides (`tdd-wave/10/d-portfolio-overrides`, PR #40)

## Wave 11 — Content depth + risk register (Phase 14 + risk closeout)

Plan: [`plans/wave11-content-and-risk.md`](./plans/wave11-content-and-risk.md).
Closes the remaining Phase 14 content-depth items and four entries from
the risk register.

- [x] Wave 11 Part A — Static legal glossary (`wave11-glossary`, PR #33)
- [x] Wave 11 Part B — i18n scaffold (en + es stub) (`wave11-i18n`, PR #34)
- [x] Wave 11 Part C — OCR language picker (`wave11-ocr-language`, PR #35)
- [x] Wave 11 Part D — Risk-register closeout: encrypted-archive review,
      crash-log privacy review, CSP regression test, rule-pack rot
      review (`wave11-risk-register`, PR #31). See `docs/SECURITY.md`.

## Phase 18 — Hybrid rules + on-device LLM

Candidate stories. Nothing on "Ready" — model footprint, CSP impact,
and the precache-cost tradeoff need empirical measurement first. See
`docs/ROADMAP.md` § Phase 18 for the framing.

- [ ] **Model selection + bundle-size budget gate** — pick a small
      classification-only model (likely a distilled BERT-class head,
      not a generative LLM) and add a precache-delta budget gate to
      `scripts/check-bundle-budget.mjs`. The contract is "OCR plus
      classifier together stay under <X MB precache" where X is set
      by what we measure. Done = model picked, weight pinned, budget
      gate green on a representative build.
      **Measured 2026-04-25** (`app/scripts/measure-llm-budget.mjs`,
      candidate `Xenova/distilbert-base-uncased`, int8 ONNX): model
      weights 64.57 MiB, tokenizer 694.7 KiB, vocab 226.1 KiB, three
      configs ~1 KiB combined; total +6 precache entries / +67045 KiB
      (~65.47 MiB). Against the existing 17-entry / 11901 KiB
      baseline that is a +563% precache delta — DistilBERT-quantized
      alone is ~5.6x the entire current shell+OCR precache.

      **Compared 2026-04-25** (Wave 18-B, `--all` candidates):
      | candidate                        | total size | + precache delta |
      |----------------------------------|------------|------------------|
      | Xenova/distilbert-base-uncased   | 65.47 MiB  | +563%            |
      | Xenova/all-MiniLM-L6-v2          | 22.81 MiB  | +196%            |
      | Xenova/paraphrase-MiniLM-L3-v2   | 17.54 MiB  | +151%            |

      **Recommendation: `Xenova/paraphrase-MiniLM-L3-v2`** as the
      Phase 18 default. ~17.5 MiB int8 is the smallest viable real
      semantic embedder on the Xenova org (smaller HF candidates
      `Xenova/bge-micro-v2` and `Xenova/gte-tiny` both return 401 —
      not redistributed under the Xenova umbrella). The +151%
      precache delta sets the next budget contract: "OCR + classifier
      ≤ 30 MiB combined precache (1.5× current Tesseract baseline)."
      Phase 18's hybrid `analyze()` path trains a thin linear
      classification head on top of these embeddings, so the model
      stays a pure embedder and the head ships as ~50 KiB of weights
      bundled with the rules engine. Re-run the script before
      locking the budget; HuggingFace file sizes drift across
      releases.

- [ ] **Hybrid `analyze()` path: regex/proximity first, LLM as
      tie-breaker** — extend `app/src/rules/analyze.ts` so paragraphs
      whose strongest matcher hit is below a confidence threshold
      (`< 0.6` is a starting guess) get a second pass through the
      classifier. Token-budget guard caps total LLM invocations per
      lease so a worst-case parse doesn't fan out unboundedly.
      Existing regex / proximity tests must stay green unchanged
      (the LLM never overrides a confident regex match).
- [ ] **Per-finding evidence attestation** — extend `Finding` with
      an optional `evidence: { tokens: number; modelId: string;
score: number }` field that the LLM path populates. The audit
      log gets a new `kind: 'llm-classify'` entry per finding the
      LLM was responsible for. Existing finding consumers stay
      working unchanged (additive field).
- [ ] **Offline-correctness contract: precache the model** — same
      pattern as Tesseract: Workbox precaches the model weights and
      tokenizer JSON; `eng.traineddata.gz` becomes a sibling of a
      new `model/<weights>` directory; same "manual one-time drop
      required" contract until weight redistribution is licensed
      (see `docs/SECURITY.md` § 5 for the model the legal review
      already accepted for tesseract).
- [ ] **WebGPU → WASM → "LLM unavailable" graceful fallback chain**
      — runtime detection picks the best available; the
      classifier UI shows a banner when neither is available and the
      hybrid path silently no-ops (rules engine still runs). No new
      audit `kind` for unavailability — the rules-only path is
      indistinguishable from "LLM disabled" in the audit log.
- [ ] **Privacy disclosure update** — add a paragraph to the
      privacy `<details>` block (and `docs/SECURITY.md`) stating
      that classifier inputs never leave the device, mirroring the
      existing parse / OCR disclosure. Bundles a re-run of the
      Wave 11 risk-register privacy check.
- [ ] **Paraphrased-clause golden test** — extend
      `src/rules/golden.test.ts` (or a new sibling) with a synthetic
      commercial lease whose auto-renewal language deliberately
      paraphrases the regex anchor. Three assertions: (a) regex/
      proximity miss the paragraph, (b) the LLM tie-breaker catches
      it, (c) the audit log records the LLM attestation. Without all
      three, the hybrid path's value proposition is unproven.
- [ ] **CSP impact audit** — verify the chosen runtime (likely
      `transformers.js` + ONNX Runtime Web, or a smaller
      `web-llm`-class loader) doesn't need any new CSP directives
      beyond the existing `default-src 'self'` + `worker-src 'self'
blob:` envelope. Done = `scripts/check-csp.mjs` stays green
      and the dist build serves the model from same-origin.

### Wave 45-D follow-ups

- [x] **Audit signed-export events.** Shipped in Wave 46 (PR #175, commit `111e743`). `useAppCallbacks.onExportSignedJson`
      signs and downloads a payload but emits no `safeAudit` entry, so
      the audit log records only unsigned exports. Add a
      `kind: 'signed-export'` audit event (file name, format, input hash,
      signing-key id) and refresh the panel after success. Codex flagged
      the resulting prose mismatch in the wave's 4th adversarial pass
      (run `20260429T135619Z`); 45-D's preamble copy was weakened to
      describe only what the code actually records, but the durable fix
      is to record the signed-export event.
- [x] **Surface success/failure for `Export public key`.** Shipped in Wave 46 (PR #175). The button
      attempts a clipboard write that may silently fail (denied
      permission, no clipboard API). Users following the signed-export
      verification copy could believe the key was shared when it
      wasn't. Return an explicit status from `onExportPublicKey`, render
      a `role="status"` confirmation, and add a clipboard-denied test.
      Same Codex pass.
- [x] **Public-key fingerprint affordance in `SigningKeyPanel`.** Shipped in Wave 46 (PR #175) via `app/src/security/fingerprint.ts` (8-char SHA-256 prefix) plus a fingerprint row + Copy affordance in the panel. Disclosure copy in `AppCurrentPane/ResultsHeader` refreshed; Q1=option-1 chosen so the recipient computes the same SHA-256 themselves rather than us shipping a verifier UI. Wave
      45-D's signed-export disclosures point users at the existing
      `Export public key` button as the out-of-band verification step,
      since the UI does not yet expose a shorter SHA-256 fingerprint
      that would be more practical to compare. Adding a fingerprint
      row (4-byte SHA-256 of the raw public key bytes, displayed in
      hex) plus a copy-to-clipboard affordance would make the
      verification workflow easier for non-technical recipients. Once
      shipped, refresh the disclosure copy to reference fingerprint
      compare instead of full public-key compare. Codex flagged the
      mismatch in the wave's 3rd adversarial pass (run
      `20260429T135226Z`). See also: the unused `keys?` /
      `KeyHistoryEntry.fingerprint` plumbing already in
      `SigningKeyPanel.tsx` — the panel can render fingerprints when a
      caller wires them in.
- [ ] **Audit-log `entryHash` column in `AuditLogPanel`.** Wave 45-D's
      first-pass preamble told users to "spot-check the first 8
      characters of the digest" — but the panel's table never renders
      `entryHash`. The instruction was removed in pass 2; surfacing
      the digest as a real column (full value plus a copy affordance)
      would make the consistency-check workflow actionable for
      practitioners.

### Wave 45-F follow-ups

- [x] **Dialog focus containment for direct `.focus()` calls.** Shipped in Wave 46 (PR #175) via the `inert` HTML attribute on Dialog background siblings. Wave 45-F
      added a Tab-only focus trap to `useFocusTrap`. App-level keyboard
      shortcuts that call `.focus()` directly (notably `App.tsx`'s `/` /
      Cmd+F findings-search shortcut) can still escape the trap. Two
      paths: (a) inert the background while a Dialog is open via the
      `inert` attribute (Chrome 102+ / Firefox 112+ / Safari 15.5+), or
      (b) seed the OnboardingTour as dismissed in App test setup so a
      focusin-guard can be reintroduced without breaking tests. Codex
      flagged this in the wave's adversarial review (run
      `20260429T124811Z`); shipped with this gap because mustFix=0 and
      the proper fix is non-trivial.

### Distill pass deferrals (filed 2026-04-29 by /impeccable distill)

The distill pass on the right-rail supporting context shipped the two highest-ROI moves (hide-empty for `LeaseFactsPanel` and `TemplateMatchesPanel`). The remaining surfaces from the distill triage were evaluated and deferred — each requires a flow / IA decision that wasn't unilateral.

- [ ] **THIS LEASE / LIBRARY / GOVERNANCE accordion shell.** Three full-width disclosure bars where one nests Compare + Custom Rule Builder + Hybrid Precision sub-panels. Structure-on-structure. Distill candidates: collapse to a single density-toggle, hide GOVERNANCE on first-run until a destructive action is needed, or split LIBRARY contents into a top-level tab. Needs a flow decision: which sections does the renter actually need vs. the practitioner.
- [ ] **Findings filter chips (4 severity + 4 category, all pressed by default).** The default state is "all visible," so chips do nothing on first paint. Distill candidates: collapse into one disclosure, only render category chips when ≥2 categories present, or surface as a single "Filter…" button that opens an inline sheet. Risk: this is the practitioner-density affordance — the dense bar may be the feature, not the noise. Validate with a practitioner before changing.
- [ ] **Combine empty `AnnotationsPanel` + `CounterOfferPanel` into one selection-bound section.** Both currently render their own heading + "click a finding" hint when no finding is selected. Combine into a single "Notes & counter-offers" panel with one shared hint, expanding into both forms once selected. Requires shared state model and discoverability decision (how does the renter learn both affordances exist).

### Polish pass deferrals (filed 2026-04-29 by /impeccable polish)

P2 visual items surfaced during the all-surfaces polish walk; deferred from the export-brand PR because they need real-browser confirmation before committing.

- [ ] **Empty home state has 60% vacant viewport.** Pre-upload, the lower 60% of the viewport is blank. Reads as "broken," not "calm." Candidates: a quiet privacy dossier line, the local-first architecture diagram, or a single restrained closing line. Brand-aligned, low risk.
- [ ] **Native file-chooser text leaks into the upload control.** Dark-mode walk shows raw "Choose File / No file chosen" platform text adjacent to the styled "Upload lease" label. Verify `FileButton` fully suppresses the native control's visual; if not, swap to a label-on-button pattern with `aria-describedby` for the file name.
- [ ] **Bottom-strip "Clear all saved data" lacks destructive treatment.** DESIGN.md reserves Negative Red for irrecoverable errors. Apply `--color-negative` to the label inside the existing Subtle button shell, or escalate to a dedicated destructive variant on the Button primitive.

### Wave 50 deferrals (filed after Wave 50 perf fix shipped)

Slice 3 of `docs/audits/perf-probe-2026-04-29.md` was deferred when Wave 50 shipped the high-impact pair (pdf.js worker restoration + pipeline pre-emption). The remaining findings:

- [ ] **`source-serif-4-400.woff2` fails to decode.** `OTS parsing error: invalid sfntVersion: 1008821359`. Body type falls back to platform serif (Iowan Old Style on macOS, Georgia elsewhere). Re-source the woff2 from upstream Source Serif 4 release; audit 500/600/italic variants too. Visual-fidelity regression DESIGN.md "Serif-for-Substance Rule" specifically rejects.
- [ ] **`audit append failed QuotaExceededError`.** Audit chain hit IDB quota during typical local use; `safeAudit` swallows the failure so subsequent writes silently lose. Either rotation policy (the test file `auditLog.rotation.test.ts` suggests one is partially designed) or a dev-only reset hook. Investigate prod exposure first.
- [ ] **Three `Uncaught (in promise)` errors during upload flow.** Likely the same IDB-teardown rejections we swallow in tests (Wave 45-BE, Wave 46) but that hit user-visible console in dev. Confirm prod-quiet vs dev-loud.
- [ ] **CSP `frame-ancestors` via `<meta>` is a no-op.** Per W3C, must be HTTP response header. Move to Vite dev-server header config (and prod static-host header config). Until then clickjacking protection isn't enforced.

### Wave 47 / 48 / 49 deferrals (filed by Wave 49 backlog reconcile)

**From `docs/audits/clarify-inventory-2026-04-29.md` (deferred from Wave 47 Slice 1):**

- [ ] **VersionHistoryPanel destructive-confirm.** `aria-label="delete version {label}"` + plain "Delete" button at `VersionHistoryPanel.tsx:105-110` triggers irreversible delete with no confirm. Add Dialog confirm naming the version + edit count. Severity M.
- [ ] **`MIN_PASSPHRASE_LEN` client-side validation.** Wave 47 added "16+ characters" helper text on passphrase fields; promoting to actual client-side `pattern` / disabled-submit-until-valid is the next step. Severity L.
- [ ] **Wave 48 Slice 2 — audit-log + onboarding vocabulary normalization** (clarify-inventory). 1H / 6M. Includes: `AuditLogPanel` kind→plain-label adapter, OnboardingTour step 2 severity vocab fix ("Critical/Warning/Info" → "High/Medium/Low/Info"), `PackManager` "Community" badge → "Unsigned" rename. Touches Wave 45-D-edited surfaces; preserve preamble verbatim.
- [ ] **Wave 48 Slice 3 — empty states + helper text + jargon plain-readings** (clarify-inventory). 1H / 6M / 8L across ~10 panels (AnnotationsPanel, LibraryPanel, JurisdictionPickerPanel, StandardSuitePanel, HybridPrecisionPanel, ClauseSimilarityPanel, RedlinePanel, ShareReviewPanel, SideLetterPanel, CustomRuleBuilderPanel intro + preview labels). Polish-pass scope; lowest per-string ROI.

**From `docs/audits/extract-inventory-2026-04-29.md` (deferred from Wave 48 Slice 1):**

- [ ] **Wave 48 Slice 2 — Card density/surface variants.** Extend `Card` with `density: comfortable|compact` and `surface: raised|sunken` to absorb 5 raised + 3 sunken `MiniCardListRow` callsites (Templates, Library, Redline, PackManager ×2, CounterOffer, Annotations, AppCurrentPane). Coordinate with Wave 47 counter-offer UX. Risk medium because Card already carries `variant="severity-…"` from Wave 45-A; test matrix grows.
- [ ] **Wave 48 Slice 3 — `<StatusMessage>` + `<ConfirmDialog>` primitives.** Consolidates 17 `<p role="status|alert">` recipes (success/error/info one-liners) and replaces 6 `window.confirm`/`window.prompt` callsites with a Dialog-based primitive. Defer crypto-passphrase migrations until a memory-zeroing pattern is specified; LibraryPanel rename is the safe first ConfirmDialog adoption.
- [ ] **ComparePanel h2/h3 migration to PanelHeader** (deferred from Wave 48 Slice 1). Three Added/Removed/Changed sub-section headers were intentionally excluded to avoid re-entering the Wave 45-C Codex review loop on a freshly-stabilized panel.
- [ ] **EvidenceQuote re-evaluation post-Wave-47.** Currently 2 callsites (`AppCurrentPane.tsx:228`, `TemplateMatchesPanel.tsx:53`); below the 3-usage threshold. Re-flag if Wave 47's `OpenReviewPanel` rewrite adds a third.
- [ ] **`state-hover` / `state-active` token alias promotion.** Currently used as `bg-[var(--state-hover)]` 6× but not first-class entries in `DESIGN.json`. Promote to named tokens for parity with the `severity-bg-*` family. Cosmetic for the design-token export.

**From this session's incidents (filed by Wave 49):**

- [ ] **Underlying RTL + IntersectionObserver race fix for `AppLibraryAndPacksPane.accordion.test`.** Linked to `app/src/test/known-flakes.md` — fix-by 2026-05-29. Hypothesis: `findByRole('group', { name: /audit log actions/i })` resolves before the lazy-mounted AuditLog sub-tree commits its `role="group"` ancestor. The Wave 49 retry is a stopgap; the real fix is await-policy or eager mount.
- [ ] **GitHub native Merge Queue revisit option.** Considered as alternative to Wave 49's "remove ~~Mergify~~, drop up-to-date requirement" approach; rejected because squash-merging makes queue serialization unnecessary. File this row only as a placeholder if we ever need merge serialization (e.g. if non-squash merges return).
- [ ] **Storybook 8 → 10 major bump.** Deferred from Wave 44 as too risky to bundle. Single-wave scope. Coordinate with the all-stories axe sweep.
- [ ] **React 18 → 19 major bump.** Deferred from Wave 44. Test-suite + StrictMode behavior changes; Suspense + transitions API changes; expect 1+ wave.
- [ ] **Type-strictness round 2 (~50 markers).** Wave 44 knocked out 10. The remainder is diffuse and low user-value; defer until paired with a feature wave that touches the same surfaces.

### Wave 35 follow-ups

- [ ] Re-run `npm run hybrid:stats` after meaningful real-world usage
      accumulates. Wave 35 Part A shipped the tool; Part A's first
      run was a NO-OP (zero audit entries on the dogfooding
      machine). Once the audit chain has ≥10 fires for at least one
      hybrid rule, re-export and re-run. If any rule clears
      `precision < 0.70`, open the deferred Wave 35 Part B
      (anchor demotions in `app/src/rules/packV1.ts`).
- [x] Pre-existing IDB cleanup race in `App.test.tsx > "clear-all
      aborts when confirmation is declined"`. Fixed in Wave 45-BE (PR #173, commit `c7bb8db`): added a process-level `unhandledRejection` listener that swallows `InvalidStateError` (code 11) post-test. The same pattern was extended to `useSigningKey.test.ts` in Wave 46. Net: 0 unhandled rejections in the suite.

### Wave 34 dark-mode follow-ups

A static walk of all 40 Storybook stories and their underlying
components surfaced **zero hard-coded color regressions in app source**:
the Wave 31-B token cascade plus Wave 32-B's palette-class regression
test are doing their job. Wave 34-C tightened the regression test to
also catch arbitrary-value hex (`bg-[#fff]`), inline-style hex
(`style={{ color: '#xxx' }}`), and SVG attribute hex (`fill="#xxx"`).
The follow-ups below are genuine UX nits that the static audit cannot
address — visual or product-level work, not source-color cleanup.

- [ ] PDF page raster is not theme-aware. `pdf.js` rasterizes the
      document as-is, so a black-ink-on-white-paper lease renders
      bright in dark mode. Themed pdf rendering would require either
      a CSS filter (`invert/hue-rotate`) on the canvas or a per-page
      post-process step. Out of scope for Wave 34; record as a Phase
      19+ candidate.
- [ ] Storybook visual snapshot infrastructure (Chromatic / Percy /
      local Playwright per-story screenshots in light + dark) would
      promote this audit from "static-grep + manual walk" to "CI-gated
      pixel diff". Explicit out-of-scope per Wave 34 spec; track here.
- [ ] Severity-bg contrast review. The `--color-severity-bg-*` tokens
      use `color-mix(... 22%, --color-paper-raised)` which derives
      automatically under dark theme; Wave 31-B claimed AA validation
      but a fresh axe + manual contrast pass against the dark palette
      would convert "claimed" to "verified". Pair with the deferred
      Wave 28-F follow-up.

## Phase 20 — Marginalia design integration

Source: `claude_design_handoff_leaseguard/` — a Claude Design handoff that
proposes a richer information architecture and a new "marginalia"
reading mode on top of the existing Marginalia token system already
in `app/src/index.css`. Tokens, type system, and severity palette are
already aligned, so this phase is IA + new components, not a retheme.

Decisions (settled 2026-04-29):

- **Reading surface**: marginalia reader is the default; the existing
  PdfViewer sits behind an in-tab toggle on Current. Both share the
  same selected-finding state.
- **Settings home**: new 5th tab "Settings" absorbs
  `AppLibraryAndPacksPane`, the privacy disclosure, locale picker, and
  theme toggle.
- **Header**: slim to wordmark + filename + tab pills + offline-dot +
  "New lease". Drop privacy / locale / theme / the verbose upload
  chrome (relocated as above).
- **Finding detail**: scholarly-footnote modal replaces the inline
  `SelectedFindingCard`.
- **No tweaks panel**: the handoff's `TweaksPanel` is a Claude Design
  artifact for live preview only and ships nothing.
- **Redline buttons** route to existing signed-JSON / HTML exports —
  no new redline-PDF export path.
- **Glossary**: handoff popover style.
- **Portfolio**: real data via `listAllLeaseRecords()`; sample list dropped.
- **Landing + loader**: adopt the annotated headline upload view and
  the staged loader ticker.

### Reading surface

- [ ] New `MarginaliaReader` component — renders
      `LeaseDocument.paragraphs` as serif body text with inline `<mark>`
      highlights for finding excerpts and a right-margin column of
      finding cards (severity-coded left border, plain-English snippet,
      paragraph reference). Source: `document-pane.jsx`. Default view
      on the Current tab; PdfViewer reachable behind an in-tab toggle.
- [ ] In-tab "Reader / PDF" toggle on Current — shared selected-finding
      state, shared scroll-into-view contract for the active highlight,
      keyboard parity (`/` focus search, ↑/↓/Enter through findings).
- [ ] New `FindingRail` component — 28px vertical column, one cell per
      paragraph, colored by max severity, click-to-jump. Source:
      `app-main.jsx` `FindingRail`. Pure derived state from
      `findings + paragraphs`.
- [ ] Marginalia paragraph numbering + heading detection re-use of
      existing `paragraphs[].kind` (`title` / `h2` / `meta` / body).
      Verify parser already emits these kinds; backfill `meta` if not.
- [ ] Glossary tooltip — restyle the existing `highlightDefinedTerms`
      output to use the handoff's `GlossaryTip` popover (dark inverted
      card, term + definition, hover/focus). Source: `document-pane.jsx`.

### Findings panel + detail

- [ ] New `FindingDetailModal` — scholarly-footnote two-pane modal
      (clause-as-page on the left, footnote with title / plain English /
      "why it matters" / suggested edit / apply buttons on the right,
      prev/next nav). Source: `findings-panel.jsx` `FindingDetail`.
      Replaces the inline `SelectedFindingCard`; preserves
      apply-suggestion + save-as-counter + promote-to-standard hooks.
- [ ] Restyle `FindingsPanel` header — large "N worth a closer look"
      display + severity chips with counts inline. Preserve existing
      category filters, collapsible severity sections, hybrid LLM badge,
      explainer disclosure, apply-suggestion + promote-to-standard
      affordances, and the search/`/`-focus contract.

### Header + landing

- [ ] Slim `AppHeader` — wordmark + filename + tab pills +
      offline-on-device indicator + "New lease" reset. Privacy
      `<details>`, locale picker, theme toggle, and the upload control
      relocate to the Settings tab; the empty-state `UploadView`
      carries the upload affordance for first-run.
- [ ] New `UploadView` empty state — "Most leases are *fine.* Three
      clauses are *not.*" headline, drop-zone row, "what you'll see"
      sample column, footer chips (local-first / 10 rules / Ed25519 /
      audit log). Source: `app-shell.jsx`.
- [ ] New `LoadingView` staged ticker — "Reading PDF…",
      "Reconstructing paragraphs…", etc. Drive stages off
      `usePipeline` lifecycle events instead of a `setTimeout` chain.

### Portfolio + redline + audit

- [ ] Restyle `PortfolioPanel` to the card-grid layout — status badge,
      mini severity heatmap (one cell per finding), totals strip in the
      header. Wire to existing `listAllLeaseRecords()`; do not ship the
      handoff's hard-coded sample list.
- [ ] Restyle `AppRedlinePane` — side-by-side diff with apply-all /
      clear-all / per-finding chip toggles. The handoff's "Export PDF"
      button routes to the existing signed-JSON / HTML export paths;
      no new redline-PDF export.
- [ ] Restyle `AuditLogPanel` — mono-font 4-column table
      (time / verb / object / hash) + Merkle-root / public-key footer.
      Preserve verify-chain + download buttons.

### Settings tab (5th view)

- [ ] Add `'settings'` to `AppViewMode`; add a 5th tab pill in the slim
      header; mount a new `AppSettingsPane` under
      `viewmode-panel-settings`.
- [ ] Move `AppLibraryAndPacksPane` (library, pack manager,
      marketplace, jurisdiction picker, severity overrides, custom
      rule builder, clause templates, standard suite, signing key,
      encrypted archive, share review, bulk import) under the
      Settings tab.
- [ ] Move privacy `<details>`, `LocalePickerPanel`, and `ThemeToggle`
      under the Settings tab. Theme toggle stays the dark-mode entry
      point.
- [ ] Footer "About / Privacy / Settings" link routes to Settings; the
      old `AppFooterControls` (encrypted archive + clear-all) folds
      into the Settings tab too.

### Migration hygiene

- [ ] Ensure new components follow the four-file convention
      (component / test / story / wire-up) per `docs/CLAUDE.md`.
- [ ] No-side-stripe policy still passes (handoff uses 2px
      borderLeft on margin notes — update the policy's allow-list or
      switch to a 1px hairline + tinted background, per DESIGN.md
      Hairline rule).
- [ ] All new severity surfaces use `<Card variant="severity-…">` +
      leading `<Badge variant="severity">`; no ad-hoc
      `border-l-${color}` shortcuts.
- [ ] axe + Lighthouse a11y gates remain green; new components covered
      by `src/ui/__tests__/all-stories.a11y.test.tsx`.
- [ ] Once IA settles, archive `claude_design_handoff_leaseguard/`
      (move under `docs/design-archives/` or delete) so it stops
      shadowing the live code.

## Cross-cutting tech debt

- [x] Extract a `usePipeline` hook — App's `handleBytes` was the
      tallest function in the codebase and now juggles OCR +
      auto-compare + save. Landed in `wire-panels` as
      `src/App/usePipeline.ts` with a dedicated test suite; exposes a
      `reanalyze()` imperative for callers to re-run analysis after a
      rule-set change.
- [x] Sections track paragraph indices (not just `Paragraph` object
      refs) so `sectionAnchored` doesn't need `Array.indexOf`. Landed
      via PR #3 (commit 614f7a4) — `Section.paragraphIndexes: number[]`
      populated by the parser, consumed by `runSectionAnchored` for
      O(1) lookups. Includes content-keyed fallback for
      JSON-rehydrated legacy `LeaseDocument`s, ambiguity rejection on
      stored indices, and doc-order section-paragraph assignment to
      prevent cross-section theft.
- [x] Fix the one react-refresh ESLint warning in
      `TemplateMatchesPanel.tsx` (move `classifyMatch` helper to its
      own file or mark it a pure helper). Landed in wave3-perf —
      lint is now clean at 0 warnings.
- [x] **Reanalyze-staleness guard**: wire a `useEffect` keyed on
      `activeRules` (plus jurisdictions + severity overrides) that
      fires `pipeline.reanalyze()` automatically. Landed Wave 7 Part D
      (`wave7-appHooks`, PR #6) as `src/App/useReanalyzeOnRulesChange.ts`,
      mounted once below `usePipeline` in `App.tsx` and keyed on a
      content fingerprint of installed packs, enabled pack ids, selected
      jurisdictions, and severity overrides (skip-first-mount dedupes
      the post-upload analyze).
- [x] **App.tsx decomposition** — original target ≤600 lines.
      App.tsx is **541 lines** (down from ~1540 pre-Wave-7-D).
      Shipped across Waves 7-D, 17-A, 18-A, 19-A, 20-B, 21-B:
      12 hooks under `src/App/use*.ts` (`usePipeline`,
      `usePackManager`, `useAnnotations`, `useRedlineState`,
      `useVersionHistory`, `useSideLetter`, `useCounterOffers`,
      `useSigningKey`, `useReanalyzeOnRulesChange`, `useReviewMode`,
      `useDerivedAppState`, `useAppCallbacks`) plus 5 sub-components
      under `src/ui/` (`AppHeader` PR #71, `AppRedlinePane` PR #74,
      `AppFooterControls` PR #77, `AppCurrentPane` PR #80,
      `AppLibraryAndPacksPane` PR #84). Coverage thresholds held
      throughout; behavior unchanged at every step.
- [x] `App.panels.test.tsx` intermittently times out under coverage
      instrumentation (v8 + jsdom). Wave 12-D set
      `vi.setConfig({ testTimeout: 15_000 })` per-file; Wave 16-A
      bumped the shared `uploadLease` `waitFor` to 5s. Both have
      held green since 2026-04-25 — closing the row. If the flake
      returns, reopen with the new failure mode rather than
      reapplying the same fix.
- [x] **Tauri CI workflow cleanup.** Resolved by Wave 42 (PR #157,
      2026-04-28) — chose retire: deleted `.github/workflows/tauri.yml`,
      removed the `app/src-tauri/` stub, dropped the Tauri reference
      from `docs/CLAUDE.md`. Decision recorded in
      `docs/wave42-tauri-decision.md`.
- [x] **npm-audit triage refresh.** Runtime-shipping vuln chain is
      **clear** as of Wave 39 (2026-04-28): `npm audit --omit=dev`
      reports 0 vulnerabilities. The Wave 36 transformers v2→v4
      migration moved the `onnxruntime-web` chain past the affected
      `protobufjs` range, so the original concern in this row no
      longer applies. Remaining 17 build-only vulns (lighthouse →
      inquirer → external-editor → tmp; storybook → uuid) are
      tolerated as before. The `package.json` `overrides` block
      (`serialize-javascript` ^7.0.5) is **still active** —
      `npm ls serialize-javascript` confirms the override is
      pinning workbox-build's transitive dep to the secure version,
      not aged out as previously assumed. Reinstating
      `npm-audit` as a required branch-protection check is a
      separate ops task; tracked under "Branch-protection
      self-healing" below.
- [ ] **Major dep bump: React 18 → 19** _(wave-44-survey)_. `npm
      outdated` shows React 18.3.1 → 19.2.5 available. Each dedicated
      wave: codemod for new JSX transform, `useFormStatus` /
      `useActionState` migration audit, validate StrictMode-safe
      ArrayBuffer copy contract still holds (see `docs/CLAUDE.md` §Data
      handling gotchas), test suite green under React 19 act-warnings.
      Pair with `@types/react` 18.3.28 → 19.2.14 in same PR.
- [ ] **Major dep bump: Vite 5 → 8** _(wave-44-survey)_. `npm outdated`
      shows Vite 5.4.21 → 8.0.10. Touches `app/vite.config.ts` (PWA
      plugin compat), `@vitejs/plugin-react` 4 → 6, Tailwind v4 plugin
      compat. Verify `vite-plugin-pwa` 0.20 → 1.2 + Workbox precache
      contract still ships sw.js for the local-first contract.
- [ ] **Major dep bump: vitest 1 → 4** _(wave-44-survey)_. `npm
      outdated` shows vitest 1.6.1 → 4.1.5 and `@vitest/coverage-v8`
      1.6.1 → 4.1.5. Major v3/v4 changed mock semantics (`vi.spyOn` on
      ESM bindings, hoisting). Plan: branch coverage gate stays at 90,
      validate the App.panels timeout fix from Wave 12-D / 16-A still
      holds, audit any test using internal vitest types.
- [ ] **Major dep bump: Storybook 8 → 10** _(wave-44-survey)_. `npm
      outdated` shows storybook 8.6.18 → 10.3.5 (and matching
      `@storybook/react`, `@storybook/react-vite`). The all-stories
      a11y sweep in `src/ui/__tests__/all-stories.a11y.test.tsx`
      (Wave 41) hits every story — verify CSF compatibility and
      action-handler shape under v10. Pair with `@storybook/test`
      bump in same PR.
- [ ] **Worker-path classifier** _(wave-44-survey, Phase 18 hold)_.
      Phase 18 embedding pass currently runs on the main thread after
      the worker returns deterministic findings (see
      `app/src/App/usePipeline.ts:146`). Move it into the worker if
      the Phase 18 re-evaluation trigger fires (per
      `docs/plans/wave40-phase18-revisit-or-retire.md` §6 — sustained
      user feedback rate showing hybrid value). Until then, deferred.
- [ ] **Branch-protection self-healing.** When the Tauri workflow row
      above ships (delete or repair), also clean up the
      `Tauri build (ubuntu-latest / macos-latest)` entries from the
      `main` branch protection's required-status-checks list, so a
      future ghost-job doesn't reappear and silently block PRs.
      Same hygiene if the npm-audit row reinstates that check —
      verify the context name matches the actual job name (CI was
      green-by-bypass for ~4 waves while branch protection gated on
      misnamed/missing checks; see project memory
      `project_ci_~~mergify~~_discrepancy.md`). Also consider
      reinstating `enforce_admins: true` once the failing-but-not-
      required checks are gone — currently disabled to allow merge
      on red rollups.

## Known unknowns & risk register

Things worth a deliberate decision before they surprise us.

- [x] **Licensing audit of tesseract assets** — we ship
      `tesseract-core.wasm` (Apache-2.0), the tesseract.js worker
      (Apache-2.0), and `eng.traineddata.gz` (Apache-2.0). Apache-2.0
      §4(d) attributions now live in `app/public/NOTICE` (precached,
      reachable at `/NOTICE` from the installed PWA); `docs/SECURITY.md`
      §5 documents the redistribution model and re-review trigger;
      `app/src/security/notice.test.ts` is the build-time tripwire so
      a refactor that drops the file fails CI.
      Decision: closed — re-review only on new asset addition or
      tesseract major-version bump; routine eng-only patch bumps
      inherit the same obligations and need no audit (2026-04-25).
- [x] **Security review of the encrypted archive format** —
      Decision: stay on PBKDF2-HMAC-SHA256 200k iterations + AES-GCM-256
      for v1; defer Argon2id to a v2 archive format with explicit
      revisit on **2026-10-01**. Threat model + trigger conditions
      documented in `docs/SECURITY.md` §1 (2026-04-25).
- [ ] **Tauri code-signing + notarization** — CI builds unsigned
      `.app`/`.dmg`/`.msi` on every PR (Wave 14-A). Distribution-grade
      signing needs an Apple Developer ID + a Microsoft EV
      code-signing cert; deferred until real distribution channels
      exist. Re-open when we're ready to ship installers outside the
      PWA (2026-04-25).
- [x] **Release & versioning policy** — `RULE_PACK_VERSION`,
      `app/package.json` version, release tags, and the signed-export
      envelope (`leaseguard.findings.vN`) are now four independent
      axes with explicit bump rules in
      [`RELEASING.md`](./RELEASING.md). Signed-format compatibility
      contract (v1 payload shape + triggers for v2) lives in
      [`SECURITY.md`](./SECURITY.md) §6. Decision: closed — the two
      docs are the gate; any future PR that bumps a version cites
      whichever section justifies the bump (2026-04-25).
- [x] **Crash-log privacy review** —
      Decision: `diagnosticsReport` now emits a `summary: string[]`
      field enumerating every category included (`userAgent`,
      `stack-traces (last 20)`, `rule-pack versions`, `no PDF bytes`,
      `no IDB contents`); the Error Boundary surfaces the same list
      above the download button so users see exactly what they would
      share. Documented in `docs/SECURITY.md` §2 (2026-04-25).
- [x] **CSP regression tests** —
      Decision: shipped `app/scripts/check-csp.mjs` (+ test fixture)
      as a post-`npm run build` gate that scans `dist/index.html` and
      `dist/sw.js` for any third-party origin in script/link/img/CSS
      `url()`/`importScripts` references. Wired into the CI workflow
      after `npm run build`. Documented in `docs/SECURITY.md` §3
      (2026-04-25).
- [x] **Rule-pack rot** —
      Decision: added a rot-review test block to
      `app/src/rules/packV1.test.ts` that asserts every v1 rule has a
      non-empty `plainEnglish` AND `suggestedEdit`, freezing the
      current audit pass. Quarterly (next 2026-07-25) and annual (next
      2027-04-25) human review cadences documented in
      `docs/SECURITY.md` §4 (2026-04-25).
- [x] **npm audit standing decisions** — `app/` reports 4 critical
      (`protobufjs <7.5.5` via `@xenova/transformers`) + 9 moderate
      (`esbuild`/`vite` chain). Both audited in Wave 26-B and
      consciously deferred: the critical never reaches the
      vulnerable `protobufjs.parse()` (Phase 18 only uses
      `transformers.pipeline()`); the moderate is dev-server-only
      and the auditor's fix needs vite@8 (Wave 27 candidate).
      Decisions + revisit triggers documented in `docs/SECURITY.md`
      §7 (2026-04-26). Re-run `cd app && npm audit` quarterly.
- [ ] **Vite 7-or-8 upgrade** (Wave 27 candidate) — clears the
      moderate dev-time esbuild chain. Pre-flight: storybook 8 +
      `vite-plugin-pwa` compatibility check; coverage threshold
      revalidation; Workbox precache size verification.
- [ ] **`@xenova/transformers` upstream bump watch** — when
      transformers ships with `protobufjs >= 7.5.5`, take the
      bump and retire `SECURITY.md` §7.1's "accept risk" line.

## Explicitly out of scope

- Cloud sync, accounts, team collaboration (local-first contract).
  Encrypted-archive share (Phase 4) is the approved escape hatch.
- Telemetry / analytics of any kind, including anonymous usage counts.
- Runtime LLM inference over network. Build-time generation of static
  content by the maintainer is allowed (Phase 14); live API calls are
  not.
- Jurisdiction-specific legal **advice**. Jurisdiction-tagged rules
  (Phase 10) surface clauses without drawing conclusions.
- Anything that requires a backend service to work.
