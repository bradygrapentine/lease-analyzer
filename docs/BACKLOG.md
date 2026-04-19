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

Current automated footprint: **196 tests · 97% statements · 86% branches**,
enforced by CI via `npm run test:coverage`. Bundle-size budgets enforced by
`npm run check:budget`.

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
- [x] IndexedDB wrapper (idb), versioned schema (v1 → v2 with settings)
- [x] Save + list + open + rename + delete
- [x] Standard-lease pointer + auto-compare on upload
- [x] JSON export (schema `leaseguard.findings.v1`)
- [x] Printable HTML export (`@media print`, XSS-escaped)
- [x] Encrypted archive export/import (AES-GCM + PBKDF2, `LGv1` magic)
- [x] Clear-all with confirmation

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

## Cross-cutting tech debt

- [ ] Extract a `usePipeline` hook — App's `handleBytes` is the tallest function in the codebase
- [ ] Share a single `copyBytes` helper rather than inline `new Uint8Array(...)` in App + PdfViewer
- [ ] Sections track paragraph indices (not just Paragraph refs) to simplify sectionAnchored mapping
- [ ] `renderPdfPages` should accept an `AbortSignal` rather than returning a custom handle

## Explicitly out of scope

Cloud sync, accounts, team collaboration, LLM-based summarization,
jurisdiction-specific legal reasoning, telemetry / analytics of any kind.
