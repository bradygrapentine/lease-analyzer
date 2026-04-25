# Backlog

Concrete, shippable stories mapped to `ROADMAP.md`. Each `[ ]` item is small
enough to land in one PR.

## Status legend

| Mark | Meaning |
|------|---------|
| `[x]` | Done and in `main` |
| `[~]` | Partial — scope cut with a note; follow-up ticket below |
| `[ ]` | Not started |
| `!`   | Blocker (no blockers at time of writing) |

## Current footprint

| Axis | Value | Gate |
|------|-------|------|
| Source | 117 non-test files (~13.0k LOC) + 91 test files (~12.5k LOC) | `find app/src -name '*.ts' -o -name '*.tsx'` |
| Tests | ~890 passing across 121 files (app) + 8 in `cli/` | `npm test` |
| Coverage | 97.02% stmt · 88.06% branch · 93.21% func · 97.02% line | `npm run test:coverage` (thresholds 90/85/90/90) |
| Bundles | app shell ~290 KiB (`index-*.js` + split) · pdf.js api 400 KiB · pdf.worker 1.3 MiB · leaseWorker ~8 KiB · tesseract runtime 8 MiB (opt-in) | `npm run check:budget` |
| IndexedDB | main `leaseguard` v3 (`leases` + `settings` + `clauseTemplates`); 8 side dbs: `leaseguard-packs` v3 (adds `signatures` store), `leaseguard-annotations` v1, `leaseguard-counters` v1, `leaseguard-signing` **v2** (multi-key store, post Wave 8-D), `leaseguard-audit` v1 (entries gain optional `signedByKeyId`), `leaseguard-redlines` v1, `leaseguard-versions` v1, `leaseguard-bulk-dedup` v1 | migrations tested |
| App.tsx | decomposed into per-panel containers around `usePipeline` (Wave 7-D) | — |
| CLI | `leaseguard-verify` (Node, no browser, no network) — `cli/` workspace, 3 tests | `cd cli && npm test` |
| Build | Vite 5 + vite-plugin-pwa → `dist/` with `sw.js`; Web Worker chunk for parse+analyze | `npm run build` |
| Lint / types | `tsc -b --noEmit` + ESLint clean (0 warnings) | `npm run typecheck && npm run lint` |

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
- [ ] Playwright smoke test (browser sanity is currently manual via Chrome DevTools MCP)
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
- [~] Real scanned-PDF fixture (detection works via `needsOcr`; binary fixture pending)
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
- [ ] Full a11y audit (basic labels in place)

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
- [ ] Lighthouse a11y + PWA scores ≥ 95 in CI
- [~] Tauri desktop wrapper scaffold committed (`app/src-tauri/`); needs Rust toolchain locally to build. CI pending.
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
- [ ] Golden tests: a commercial lease fixture exercising table +
      definitions + references simultaneously.

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
      Landed wave 4 (`wave4-virtualized`) via `src/ui/useInViewport.ts`
      + FindingsPanel viewport-gated rendering so long finding lists
      stay cheap to scroll.
- [ ] Secondary IndexedDB index on `LeaseRecord.findingCount` +
      `rulePackVersion` so `listLeases` can filter cheaply.
      `src/storage/storage.ts` today only indexes `by-createdAt`; a
      compound index unlocks portfolio-view filtering without a full
      table scan. Bump the `leaseguard` DB version and add a v4
      migration gate.
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
- [ ] Static legal-term glossary at `app/public/glossary/v1.json`;
      consumed by the defined-terms tooltip in
      `src/ui/highlightDefinedTerms.ts`. Directory does not yet exist.
- [ ] i18n scaffold: lift UI strings to a typed `messages` object;
      locale picker; pilot with en + one other locale. Today the app
      has no `i18n/` module; only `toLocaleDateString` sprinkled
      through panels.
- [ ] OCR language picker once a second `*.traineddata.gz` lands —
      today `runOcr` is hard-coded to English.

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
- [ ] **Reanalyze-staleness guard**: wire a `useEffect` keyed on
      `activeRules` (plus jurisdictions + severity overrides) that
      fires `pipeline.reanalyze()` automatically. Today every caller
      that mutates rules (custom rule save, jurisdiction toggle,
      severity override, pack enable/disable) has to remember to call
      `pipeline.reanalyze()` by hand — missing call = stale findings
      panel.
- [ ] **App.tsx decomposition** — currently ~1540 lines (was ~835 at
      the last footprint refresh) because every panel mounts its own
      handlers inline. Split into child hooks:
      `usePackManager`, `useAnnotations`, `useRedlineState`,
      `useVersionHistory`, `useSideLetter`, `useCounterOffers`,
      `useSigningKey`. Target: App.tsx under ~600 lines.
- [ ] `App.panels.test.tsx` intermittently times out under coverage
      instrumentation (v8 + jsdom). Add a per-test timeout bump or
      split the panel-mount smoke tests into a smaller file so
      `npm run test:coverage` stays green without `--testTimeout` hacks.

## Known unknowns & risk register

Things worth a deliberate decision before they surprise us.

- [ ] **Licensing audit of tesseract assets** — we ship
      `tesseract-core.wasm` (Apache-2.0) and the worker script
      (Apache-2.0). `eng.traineddata` is Apache-2.0 per the
      tessdata-fast repo, but redistributing it inside the PWA needs
      an explicit NOTICE file and attribution page.
- [ ] **Security review of the encrypted archive format** — confirm
      200k PBKDF2 iterations are still adequate in 2026; consider
      Argon2id via WASM; document threat model explicitly.
- [ ] **Release & versioning policy** — no version bumps yet; decide
      when rule-pack changes bump `RULE_PACK_VERSION` vs the package
      version. Tie to the signed-export format.
- [ ] **Crash-log privacy review** — `diagnosticsReport` today bundles
      `navigator.userAgent` and stack traces; if a user shares the
      JSON, what might leak? Add a user-visible "what's in this file"
      summary before download.
- [ ] **CSP regression tests** — an automated check that `index.html`
      and `sw.js` don't pick up CDN URLs across dependency upgrades.
- [ ] **Rule-pack rot** — the v1 rules were hand-authored; schedule a
      review pass now that golden leases and the jurisdiction tag
      scheme from Phase 10 exist.

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
