# Backlog

Concrete, shippable stories mapped to `ROADMAP.md`. Each item is small enough
to land in one PR. Order within a phase is the suggested work order.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `!` blocker

---

## Phase 0 — Foundations
- [ ] Scaffold Vite + React + TS app in `app/`
- [ ] Add strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`)
- [ ] Add ESLint + Prettier + `lint-staged` pre-commit
- [ ] Add Vitest with a sample test; wire `pnpm test`
- [ ] Add Playwright smoke test (app boots, shows upload)
- [ ] GitHub Actions: typecheck + lint + test on PR
- [ ] Commit sample lease fixtures to `fixtures/` (residential, commercial, scanned)
- [ ] CSP meta tag: `default-src 'self'`; document the no-egress contract

## Phase 1 — PDF Parser
- [ ] Integrate `pdfjs-dist`; bundle worker locally (no CDN)
- [ ] `extractPages(file) → PageText[]` with positions + font sizes
- [ ] Paragraph reconstruction (line joining, hyphen repair, header/footer strip)
- [ ] Heading/section detection (numbered, bold, ALL CAPS heuristics)
- [ ] Define `LeaseDocument` type + parser output contract
- [ ] Golden-file tests against 3+ fixture leases
- [ ] Benchmark: 50-page lease parses < 1.5s on M1
- [ ] Handle password-protected PDFs with a clear error

## Phase 2 — Rules Engine
- [ ] Define `Rule` type + JSON schema (id, severity, category, pattern, explain, cite)
- [ ] Implement matchers: `regex`, `keywordProximity`, `sectionAnchored`, `negated`
- [ ] `analyze(doc, rules) → Finding[]` with stable ordering
- [ ] Ship rule pack v1 (10 rules listed in roadmap)
- [ ] Per-rule snapshot tests with positive + negative fixtures
- [ ] Confidence scoring (exact match vs. fuzzy)
- [ ] Rule pack versioning + provenance on each finding

## Phase 3 — UI
- [ ] Upload dropzone, disables network, accepts `application/pdf`
- [ ] PDF viewer pane using pdf.js canvas renderer
- [ ] Findings panel: grouped by severity, collapsible by category
- [ ] Click finding → scroll-to + highlight span in viewer
- [ ] In-document search (Cmd/Ctrl-F)
- [ ] Severity + category filter chips
- [ ] Loading / empty / parse-error states
- [ ] Keyboard navigation across findings (↑/↓/Enter)
- [ ] A11y pass: labels, focus ring, contrast, ARIA roles

## Phase 4 — Local Storage
- [ ] IndexedDB wrapper (idb) with versioned migrations
- [ ] Save lease + findings on analyze; list in "My Leases"
- [ ] Rename, delete, open-from-library
- [ ] Export findings as JSON
- [ ] Export printable HTML summary (print-stylesheet)
- [ ] Encrypted archive export/import (WebCrypto, passphrase-derived key)
- [ ] "Clear all data" control with confirmation

## Phase 5 — V2: Compare & OCR
- [ ] Two-lease diff view; align sections, highlight clause-level deltas
- [ ] Rule-aware diff: flag when a risky clause is added/removed/softened
- [ ] OCR fallback (tesseract.js) when page text density < threshold
- [ ] OCR quality indicator + re-run option
- [ ] "My standard clauses" library + compare-against-standard mode

## Phase 6 — Polish & Distribution
- [ ] Performance budget CI check (50-page parse < 3s)
- [ ] Lighthouse a11y + PWA scores ≥ 95 in CI
- [ ] PWA manifest, service worker, offline shell
- [ ] Tauri desktop wrapper (optional) with local library folder
- [ ] Onboarding tour + sample lease
- [ ] Privacy page explaining the no-network guarantee

## Tech debt / cross-cutting
- [ ] Error boundary + telemetry-free crash log (local only)
- [ ] Bundle-size budget; code-split pdf.js worker
- [ ] Storybook for viewer + findings panel components
- [ ] Document rule-authoring guide in `docs/RULES.md`
