# Roadmap

LeaseGuard is a private, local-first lease analyzer. Everything runs in the
browser — no server, no uploads leaving the device. Stack: React + pdf.js +
rules engine + IndexedDB. Build order per CLAUDE.md: **parser → rules → UI**.

## Phase 0 — Foundations
Repo scaffolding and guardrails so everything after moves fast.
- Vite + React + TypeScript skeleton
- ESLint, Prettier, strict tsconfig
- Vitest + Playwright for unit and e2e
- GitHub Actions: typecheck, lint, test on PR
- Baseline `index.html` shell with CSP that forbids network egress

## Phase 1 — PDF Parser (MVP core)
Turn an uploaded PDF into structured, queryable text.
- pdf.js integration (worker bundled locally, no CDN)
- Page-by-page text extraction with layout metadata (x/y, font size)
- Paragraph reconstruction (join broken lines, strip headers/footers)
- Section detection (numbered clauses, headings)
- Normalized `LeaseDocument` model: `{pages, sections, paragraphs, raw}`
- Parser unit tests against fixture leases (residential + commercial)

## Phase 2 — Rules Engine
Detect risky or noteworthy clauses in a normalized lease.
- Rule DSL (JSON/TS): id, severity, category, pattern, explanation, citation
- Matchers: regex, keyword proximity, clause-anchored, negation-aware
- Rule pack v1: auto-renewal, early-termination fees, assignment/subletting,
  late fees, attorney-fees, security-deposit limits, waiver of jury trial,
  arbitration, indemnification, rent escalation, personal guaranty
- Finding model: rule hit + span + page + confidence + rationale
- Deterministic output; snapshot tests per rule

## Phase 3 — UI
Make findings legible to a non-lawyer.
- Upload dropzone, local file only (no network)
- Split view: PDF viewer (pdf.js) ↔ findings panel
- Click a finding → scrolls + highlights the exact span in the PDF
- Severity filters, category grouping, search within document
- Empty / loading / error states
- Keyboard-first navigation, a11y pass

## Phase 4 — Local Storage
Persist leases and findings on-device only.
- IndexedDB schema: leases, findings, rule-pack versions
- Lease library view (list, rename, delete, open)
- Export: JSON report + printable HTML summary
- Import/export encrypted archive (passphrase) for backup

## Phase 5 — V2: Compare & OCR
Stretch features from original roadmap.
- Lease diff: side-by-side comparison of two leases, rule-aware
- OCR fallback via Tesseract.js for scanned/image PDFs
- Clause library: reusable "my standard" clauses to compare against

## Phase 6 — Polish & Distribution
- Performance budget: parse 50-page lease < 3s on M1
- Accessibility: WCAG 2.1 AA
- PWA install, offline-first, cached assets
- Optional desktop wrapper (Tauri) for file-system library mode

## Phase 7 — Observability & hygiene
Local-only, CSP-compatible guardrails for long-term maintainability.
- Error boundary + in-memory crash log (no telemetry leaves device)
- "Download diagnostics" bundle of the last N errors
- Rule-authoring guide (`docs/RULES.md`) with matcher cookbook
- Storybook for viewer + findings components
- Bundle-size budget in CI, pdf.worker code-split

## Out of scope (for now)
Cloud sync, accounts, team collaboration, LLM-based summarization,
jurisdiction-specific legal advice, telemetry.
