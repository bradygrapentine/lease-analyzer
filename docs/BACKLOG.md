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
| Tests | 196 passing (pre-merge baseline — will update once all phase merges land) | `npm test` |
| Coverage | 97% stmt · 86% branch · 93% func · 97% line (above 90/85/90/90 thresholds) | `npm run test:coverage` |
| Bundles | app shell 197 KiB · pdf.js api 400 KiB · pdf.worker 1.3 MiB · tesseract runtime 8 MiB (opt-in) | `npm run check:budget` |
| IndexedDB | schema v3 (`leases` + `settings` + `clauseTemplates`) | migrations tested |
| Build | Vite 5 + vite-plugin-pwa → `dist/` with `sw.js` | `npm run build` |
| Lint / types | `tsc -b --noEmit` + ESLint clean (1 pre-existing react-refresh warn) | `npm run typecheck && npm run lint` |

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

- [ ] Table detection: cluster text items into row/column grids when
      y-alignment + x-column consistency exceed a threshold; emit
      `Table { rows: Cell[][], page, bbox }` model.
- [ ] Rent-schedule extraction as the first use case; typed
      `RentSchedulePeriod[]` (from/to dates, amount, escalator).
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
      the new `LeaseFactsPanel` (populated + empty stories). App wiring
      left to follow-up PR.
- [ ] Hover-glossary in the findings panel (tooltip on defined terms).
- [ ] Golden tests: a commercial lease fixture exercising table +
      definitions + references simultaneously.

## Phase 9 — Negotiation support

- [ ] `Annotation` IndexedDB store (keyed by leaseId+paragraphIndex);
      add/edit/delete UI anchored to the findings panel.
- [ ] Redline edit mode: contentEditable paragraph rendering with
      tracked-changes diff, stored separately from the original.
- [ ] Export redlined HTML with `<ins>`/`<del>` tags + print stylesheet.
- [ ] Counter-offer library (extends Phase 5 clause templates):
      per-rule "suggested replacement" field, editable per user.
- [ ] "Apply suggestion" button on a finding → inserts template text
      into the redline mode as a proposed change.
- [ ] Version history: each save of a redlined doc creates a new
      `LeaseRecord` version; navigate versions with a timeline.
- [ ] Side-letter generator: given a set of proposed edits, produce a
      numbered, printable letter with section citations.

## Phase 10 — Rule ecosystem

- [~] JSON Schema for rule packs (`leaseguard.rulepack.v1`). Validate
      on import, reject malformed. Implemented as a hand-rolled
      validator in `src/rules/packSchema.ts` (no ajv dep); covers
      matcher-type / severity / category enums + regex compileability.
      Diff-vs-currently-loaded UI still open.
- [~] Import/export UI: list installed packs; disable/enable per
      pack; accept `.lgpack.json`. Implemented in
      `src/ui/PackManagerPanel.tsx`, backed by
      `src/rules/packStorage.ts` (separate `leaseguard-packs`
      IndexedDB database). Drag-and-drop, export-to-disk, and
      App.tsx wiring still open — panel shipped as a pure
      props-driven component pending wire-up ticket.
- [ ] Custom-rule authoring UI: form-driven matcher builder with live
      "does this fire on the current lease?" preview.
- [ ] `Rule.jurisdictions?: string[]` field (ISO-like codes, e.g.
      `"US-CA"`). UI jurisdiction picker; runtime filter.
- [ ] Per-user severity overrides persisted in settings.
- [ ] Ed25519 signature support via WebCrypto; "verified" vs
      "community" badge in the pack list.
- [~] Bundle a small offline marketplace of curated packs as static
      JSON under `/public/packs/`. Seeded with
      `example-starter.lgpack.json` produced by
      `scripts/build-example-pack.mjs`; full curated marketplace
      still open.

## Phase 11 — Workflow & integrations

- [~] `.ics` export — pure `buildIcs({leaseName, dates})` primitive
      landed in `src/workflow/buildIcs.ts` (RFC 5545, 75-octet folding,
      escape handling, all-day events). Still pending: Phase 8
      `LeaseFacts` → `IcsDateInput[]` adapter and the App wire-up.
- [x] "Copy summary" button → HTML + plain-text to the clipboard via
      `navigator.clipboard.write` + `ClipboardItem`, with `writeText`
      fallback. `buildSummary` + `copyToClipboard` in
      `src/workflow/copySummary.ts`.
- [x] Lawyer handoff ZIP: original PDF + HTML report + JSON + readme,
      bundled via a hand-rolled STORE-only ZIP writer
      (`src/workflow/buildHandoffZip.ts`). No new deps.
- [ ] Portfolio view: grid of leases across the library with counts
      per rule id; filterable.
- [ ] Bulk import: drop a zip/folder of PDFs; progress bar; per-file
      status; deduplicate by content hash.
- [~] `WorkflowPanel` UI primitive (`src/ui/WorkflowPanel.tsx` +
      stories) with three action buttons and status. App wire-up is a
      follow-up PR per the constraints of this pass.

## Phase 12 — Trust & verification

- [x] `reproducibility.test.ts`: run `analyze` N times over the same
      fixture, assert byte-identical output. (Confirmed already
      deterministic; test uses synthetic residential + commercial PDF
      fixtures with N=3.)
- [x] Signing keypair: generate + store via WebCrypto, unlocked with a
      passphrase (reuse the archive-export passphrase pattern).
      Ed25519; private key PBKDF2+AES-GCM-wrapped in a separate
      `leaseguard-signing` IndexedDB.
- [x] Signed JSON export: add `signature` field; include `inputHash`
      (SHA-256 of the PDF), `rulePackVersion`, `findings`.
      (Schema pinned at `leaseguard.findings.v1`; `signature` is an
      optional extension. UI wire-up of the panel in `App.tsx` is
      pending and will land in a follow-up.)
- [ ] Append-only audit log in IndexedDB; hash-chained entries
      (`prevHash`); "Download audit log" button.
- [ ] Replay bundle export: ZIP with PDF + packs + expected JSON +
      replay script.
- [ ] Pack-version pin warning on `diffLeases` when sides disagree.

## Phase 13 — Performance & scale

- [ ] Spawn a dedicated Web Worker for `parseLease` + `analyze`; wire
      with `postMessage` + transferable `Uint8Array`.
- [ ] Streaming render: PdfViewer renders page N as soon as
      `getPage(N)` resolves, rather than waiting on the whole doc.
- [ ] Virtualized `<ul>` in FindingsPanel using IntersectionObserver.
- [ ] Secondary IndexedDB index on `LeaseRecord.findingCount` +
      `rulePackVersion` so `listLeases` can filter cheaply.
- [ ] Compile + cache regex instances at rule-pack import time.
- [ ] Perf benchmark grows to 200-page documents; budget scales by
      pages (e.g., ≤ 8s on 200 pages).
- [ ] `renderPdfPages` accepts an `AbortSignal` rather than returning a
      custom `{done, cancel}` handle (moved from tech debt).
- [ ] Share a single `copyBytes(bytes): Uint8Array` helper rather than
      inline `new Uint8Array(...)` at every pdf.js hand-off site
      (moved from tech debt).

## Phase 14 — Content depth (optional)

- [ ] Per-rule `plainEnglish?: string` field populated at build time
      by the maintainer; UI shows a "What this means" expandable.
- [ ] Per-rule `suggestedEdit?: string` consumed by the Phase 9
      counter-offer flow.
- [ ] Static legal-term glossary at `public/glossary/v1.json`;
      consumed by the definitions tooltip.
- [ ] i18n scaffold: lift UI strings to a typed `messages` object;
      locale picker; pilot with en + one other locale.
- [ ] OCR language picker once a second `*.traineddata.gz` lands.

## Cross-cutting tech debt

- [ ] Extract a `usePipeline` hook — App's `handleBytes` is the tallest
      function in the codebase and now juggles OCR + auto-compare +
      save; promoting it to a hook would cut App.tsx by ~100 lines and
      free up branch coverage we're currently shoring up with App tests.
- [ ] Sections track paragraph indices (not just `Paragraph` object
      refs) so `sectionAnchored` doesn't need `Array.indexOf`.
- [ ] Fix the one react-refresh ESLint warning in
      `TemplateMatchesPanel.tsx` (move `classifyMatch` helper to its
      own file or mark it a pure helper).

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
