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

---

Phases 0–7 cover the lease-analyzer *as pitched in the original README*.
The phases below extend the product along orthogonal axes — deeper parsing,
user-authored content, negotiation support, workflow integrations, trust,
and scale — without breaking the local-first, no-network contract.

## Phase 8 — Structured lease understanding
Pull more than prose out of the PDF. The current parser sees paragraphs;
this phase teaches it to see tables, defined terms, cross-references, and
key numbers.
- **Table extraction** — detect rent schedules, escalator tables, and
  option-to-renew matrices via positional clustering (multi-column layouts
  with aligned Y-rows). Emit a `Table` model alongside paragraphs.
- **Definitions tracking** — detect "X shall mean Y" / "X means Y" and
  build a doc-wide definitions map; surface definition tooltips on hover
  in the viewer.
- **Cross-reference resolution** — turn "Section 5.2", "Exhibit B",
  "Schedule 1" into clickable anchors that scroll the viewer.
- **Numeric + date extraction** — first-class fields for base rent,
  security deposit, notice periods, commencement/expiration dates.
  Expose them as a `LeaseFacts` object (separate from rule findings).
- **Glossary UI** — hover any defined term in the findings panel to see
  its in-document definition.

## Phase 9 — Negotiation support
Turn LeaseGuard from a one-shot analyzer into a tool the tenant/landlord
uses during back-and-forth.
- **Inline annotations** — users attach notes to paragraphs; annotations
  persist in IndexedDB alongside the lease record.
- **Redline mode** — edit paragraph text in the findings pane; export
  tracked-changes HTML + a patch file that can be applied by the other
  side's copy.
- **Counter-offer suggestions** — per-rule replacement text (e.g., for a
  one-way attorney-fees clause, a mutual-fees rewrite). User-customisable;
  stored as clause templates (Phase 5 feature, reused).
- **Version history** — each analyze of the same filename creates a new
  version; `diffLeases` already does the heavy lifting, so the UI just
  surfaces the stack.
- **Side-letter generator** — given selected findings, produce a
  printable letter listing requested edits with clause citations.

## Phase 10 — Rule ecosystem
Make the rule pack a first-class content artifact users can extend,
share (as files, not via cloud), and trust.
- **External rule-pack import** — accept `.lgpack.json` files with a
  stable schema + version; validate against JSON Schema at import time.
- **Custom rule authoring** — UI for users to write their own matchers
  (guided pickers for keywordProximity / regex) and save as a local pack.
- **Jurisdiction tags** — each rule gets an optional `jurisdictions:
  string[]`; users pick one or more tags (e.g., "US-CA", "US-TX") and
  only matching rules run.
- **Severity overrides per user** — "treat arbitration as Low for my
  use case" without forking the pack.
- **Signed packs** — optional Ed25519 signature on the pack file;
  imported unsigned packs show a "community" badge, signed packs show
  the verified author.
- **Pack marketplace (offline-only)** — in-app directory of known packs
  bundled as static JSON; users install with one click. No network
  fetch — packs are curated at build time.

## Phase 11 — Workflow & integrations
Local-first doesn't mean isolated. Help users hand findings off to
wherever they actually live.
- **Calendar export** — generate an `.ics` file with rent-due,
  renewal-notice, and expiration dates from Phase 8's extracted fields.
- **Email draft** — copy a pre-formatted summary (HTML + plain text)
  to the clipboard so the user can paste into their mail client.
- **Lawyer handoff packet** — bundle the HTML report + the original
  PDF + a structured JSON into a single ZIP for forwarding.
- **Portfolio view** — for users with many leases, aggregate findings
  across the library: "12 leases have auto-renewal clauses, 4 waive
  jury trial". Render a simple matrix.
- **Bulk import** — drop a ZIP of PDFs; analyze each in sequence with
  a progress bar.

## Phase 12 — Trust & verification
Make the analysis itself auditable. For users who need to prove what
the app told them, when.
- **Deterministic analyze** — pin any randomness; guarantee that
  `analyze(doc, rules)` is byte-identical across runs on the same
  inputs and rule-pack version. Ship a `reproducibility.test.ts`.
- **Signed reports** — optional Ed25519 keypair (stored via WebCrypto
  in IndexedDB behind a passphrase); JSON exports carry a signature
  covering `{inputHash, rulePackVersion, findings}`.
- **Audit log** — append-only local log of every analyze/export event,
  hash-chained so tampering is detectable. Downloadable for review.
- **Replay bundle** — export a self-contained ZIP with the PDF bytes
  + rule pack + expected findings JSON; a CLI or another browser can
  re-run and byte-compare.
- **Version-pin UI** — when comparing leases across rule-pack versions,
  warn the user and offer to re-analyze the older one with the current
  pack.

## Phase 13 — Performance & scale
Today LeaseGuard handles a 50-page lease in 210 ms. These items keep
that budget intact as documents, rule packs, and libraries grow.
- **Web Worker for analyze + parse** — move the heavy pipeline off the
  main thread; the UI stays responsive during OCR on multi-hundred-page
  leases.
- **Streaming parse** — render the viewer's first page while later
  pages are still extracting.
- **Virtualized findings list** — windowed rendering for leases with
  100+ findings.
- **IndexedDB indexes** — add secondary indexes for category + severity
  to avoid loading every `LeaseRecord` to list metadata.
- **Rule compilation cache** — pre-compile regexes at pack-import time
  rather than on every analyze.

## Phase 14 — Content depth (optional, still no network)
Make findings more useful without phoning home. Everything ships
statically in the PWA bundle.
- **Plain-English rationales** — LLM-generated *at build time* by the
  maintainer (no runtime API calls), vetted, and committed as part of
  the rule pack. Findings get a "What this means in plain English"
  expandable.
- **"How to fix" suggestions** — per-rule canned edits, again
  build-time, not runtime.
- **Embedded legal glossary** — static JSON of common lease terms;
  surface inline via the definitions tooltip from Phase 8.
- **i18n** — UI strings externalized; start with English + one
  non-English locale as a proof.
- **OCR language expansion** — additional `.traineddata.gz` packs
  (same manual-drop mechanism as English) with a language picker.

---

## Out of scope (for now)
- Cloud sync, accounts, team collaboration — would violate the
  local-first contract. Syncing via user-initiated encrypted archive
  (Phase 4) is the escape hatch.
- Telemetry / analytics of any kind, including "anonymous".
- Runtime LLM inference over network. Build-time generation of static
  content by the maintainer is fine (Phase 14); a live API call is not.
- Jurisdiction-specific legal *advice*. Jurisdiction-tagged rules
  (Phase 10) are fine because they surface clauses, not conclusions.
- Anything that requires a backend service to work.
