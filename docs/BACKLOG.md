# Backlog

Concrete, shippable stories mapped to `ROADMAP.md`. Each item is small enough
to land in one PR. Order within a phase is the suggested work order.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `!` blocker

---

## Phase 0 — Foundations
- [x] Scaffold Vite + React + TS app in `app/`
- [x] Add strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`)
- [x] Add ESLint + Prettier + `lint-staged` pre-commit
- [x] Add Vitest with a sample test; wire `npm test`
- [ ] Add Playwright smoke test (app boots, shows upload)
- [x] GitHub Actions: typecheck + lint + test on PR
- [ ] Commit sample lease fixtures to `fixtures/` (residential, commercial, scanned)
- [x] CSP meta tag: `default-src 'self'`; document the no-egress contract

## Phase 1 — PDF Parser
- [x] Integrate `pdfjs-dist`; bundle worker locally (no CDN)
- [x] `extractPages(file) → PageText[]` with positions + font sizes
- [x] Paragraph reconstruction (line joining, hyphen repair, header/footer strip)
- [x] Heading/section detection (numbered, bold, ALL CAPS heuristics)
- [x] Define `LeaseDocument` type + parser output contract
- [x] Golden-file tests (synthetic residential + commercial fixtures; scanned deferred)
- [x] Benchmark: 50-page parse budget (3s; measured ~210ms in test env)
- [x] Handle password-protected PDFs with a clear error

## Phase 2 — Rules Engine
- [x] Define `Rule` type + JSON schema (id, severity, category, pattern, explain, cite)
- [x] Implement matchers: `regex`, `keywordProximity`, `sectionAnchored`; negation as post-filter
- [x] `analyze(doc, rules) → Finding[]` with stable ordering
- [x] Ship rule pack v1 (10 rules)
- [x] Per-rule positive tests + benign negative
- [x] Confidence scoring (regex 0.9, proximity 0.75, ×0.5 when negated)
- [x] Rule pack versioning + provenance on each finding (`rulePackVersion`)

## Phase 3 — UI
- [x] Upload control, accepts `application/pdf`
- [x] PDF viewer pane using pdf.js canvas renderer (canvas scaffolding + render path; verify in browser)
- [x] Findings panel: grouped by severity
- [x] Collapsible severity groups
- [x] Click finding → scrolls viewer to that page
- [ ] Span-level highlight overlay in viewer (deferred — needs text-layer)
- [x] Click finding → show selected snippet + page number
- [x] Search-within-findings (title/explanation/snippet)
- [ ] Cmd/Ctrl-F hotkey for global doc search
- [x] Severity + category filter chips
- [x] Loading / empty / parse-error states (idle/loading/analyzed/error)
- [x] Keyboard navigation across findings (↑/↓/Enter)
- [ ] Full a11y pass: contrast, focus ring, ARIA audit (labels in place)

## Phase 4 — Local Storage
- [x] IndexedDB wrapper (idb) with versioned migrations
- [x] Save lease + findings on analyze; list in "My Leases"
- [x] Delete + open-from-library (rename wired in storage, not yet in UI)
- [x] Export findings as JSON
- [ ] Export printable HTML summary (print-stylesheet)
- [ ] Encrypted archive export/import (WebCrypto, passphrase-derived key)
- [x] "Clear all data" control with confirmation

## Phase 5 — V2: Compare & OCR
- [x] Rule-aware diff: added/removed/changed findings between two leases
- [x] Compare picker in library + ComparePanel render
- [ ] Text-level diff within aligned sections (paragraph diff)
- [x] OCR detection banner when avg chars/page below threshold
- [ ] Actual OCR via tesseract.js (deferred — heavy dep; detection in place)
- [ ] "My standard clauses" library + compare-against-standard mode

## Phase 6 — Polish & Distribution
- [x] Performance budget test (50-page parse < 3s; measured ~210ms in CI-like env)
- [ ] Lighthouse a11y + PWA scores ≥ 95 in CI (manual run pending)
- [x] PWA manifest, service worker, offline shell (vite-plugin-pwa, autoUpdate)
- [ ] Tauri desktop wrapper (optional) with local library folder
- [ ] Onboarding tour + sample lease
- [x] Privacy disclosure explaining the no-network guarantee (header &lt;details&gt;)
- [x] Printable HTML summary export

## Tech debt / cross-cutting
- [ ] Error boundary + telemetry-free crash log (local only)
- [ ] Bundle-size budget; code-split pdf.js worker
- [ ] Storybook for viewer + findings panel components
- [ ] Document rule-authoring guide in `docs/RULES.md`
