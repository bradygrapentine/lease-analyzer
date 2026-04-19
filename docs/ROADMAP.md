# Roadmap

LeaseGuard is a private, local-first lease analyzer. Everything runs in the
browser — no server, no uploads, no telemetry. The stack is React + pdf.js +
a deterministic rules engine on top of IndexedDB, built in the order
**parser → rules → UI** per [`CLAUDE.md`](./CLAUDE.md).

This document is the "what and why." Ticket-level execution lives in
[`BACKLOG.md`](./BACKLOG.md); module boundaries and the privacy contract
live in [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md); rule-authoring conventions
live in [`RULES.md`](./RULES.md).

---

## What the product is today

A PWA that ingests a lease PDF, extracts structured facts, runs a signed
rule pack against it, and lets the user negotiate, redline, compare, and
export — all offline. Concretely:

- **Parser** — pdf.js (local worker), layout-aware paragraph reconstruction,
  section detection, table detection (rent schedules / escalator grids),
  defined-terms map, cross-reference anchors, numeric/date fact extraction
  into a typed `LeaseFacts` object. OCR fallback via Tesseract.js with an
  opt-in, manually-dropped `eng.traineddata.gz`.
- **Rules engine** — JSON/TS rule DSL with regex, keyword-proximity, and
  clause-anchored matchers. 10 shipped rules, each carrying
  `plainEnglish` + `suggestedEdit`. Deterministic output (pinned, with a
  reproducibility test). Compiled regex cache on pack import.
- **UI** — split viewer + findings panel with click-to-highlight,
  severity filters, hover-glossary over defined terms, virtualized
  findings list, keyboard navigation, dedicated Web Worker for parse +
  analyze with inline fallback.
- **Library** — IndexedDB stores leases, findings, rule-pack versions,
  annotations, counter-offers, redlines, version history, signing keys,
  and a hash-chained audit log.
- **Negotiation** — inline annotations, redline mode (Current / Portfolio
  / Redline view toggle) with `<ins>`/`<del>` HTML export, apply-suggestion
  from findings, counter-offer library with per-rule suggested edits,
  version history with restore/export, side-letter generator.
- **Rule ecosystem** — schema-validated `.lgpack.json` import/export,
  in-app custom-rule builder with live preview, jurisdiction tags + picker,
  per-user severity overrides, Ed25519 pack signatures with a
  verified/community badge, and a pack-diff panel.
- **Trust** — deterministic analyze, Ed25519 signed JSON reports
  (WebCrypto key in IndexedDB behind a passphrase), hash-chained audit
  log, replay-bundle ZIP export, pack-version pin warning on
  `diffLeases` with a Compare-panel banner.
- **Workflow** — `.ics` export of rent/renewal/expiration dates,
  clipboard email summary, lawyer-handoff ZIP (PDF + HTML + JSON),
  portfolio grid across the library, bulk ZIP import with dedupe.

See [`BACKLOG.md`](./BACKLOG.md) Current footprint for the file-by-file
breakdown.

---

## What's shipped vs. still open

Each phase links to its backlog section.

| Phase | Theme | Status |
| --- | --- | --- |
| 0 | Foundations | Done |
| 1 | PDF Parser (MVP core) | Done |
| 2 | Rules Engine | Done |
| 3 | UI | Done |
| 4 | Local Storage | Done |
| 5 | Compare & OCR | Done |
| 6 | Polish & Distribution | Partial — Lighthouse a11y/PWA CI, Tauri CI, onboarding tour open |
| 7 | Observability & hygiene | Done |
| 8 | Structured lease understanding | Substantially done — commercial golden fixture open |
| 9 | Negotiation support | Done |
| 10 | Rule ecosystem | Done |
| 11 | Workflow & integrations | Done |
| 12 | Trust & verification | Done |
| 13 | Performance & scale | Substantially done — streaming PdfViewer render + secondary IDB index open |
| 14 | Content depth | Substantially done — static glossary JSON, i18n scaffold, OCR language picker open |

"Substantially done" means the phase's primary surface is built and wired;
the open items are scoped follow-ups rather than net-new work.

---

## Open work, grouped by destination

The roadmap below is organized by where the product is heading, not by
phase number. Each bullet points to the backlog section that tracks the
tickets.

### Ship-readiness — getting 1.0 out the door

- Lighthouse CI gates: a11y ≥95 and PWA ≥95 on every PR. (Phase 6)
- Tauri desktop build + CI artifact. (Phase 6)
- First-run onboarding tour that explains the local-first contract and
  the OCR opt-in. (Phase 6)
- Commercial-lease golden fixture that exercises tables + definitions +
  cross-refs simultaneously. (Phase 8)

### Perceived performance — stay snappy as leases grow

- Streaming `PdfViewer` render: paint page N as soon as `getPage(N)`
  resolves, instead of waiting for the whole document. (Phase 13)
- Secondary IndexedDB index on `findingCount` + `rulePackVersion` so
  `listLeases` filters cheaply without hydrating every `LeaseRecord`.
  (Phase 13)

### Content depth — more useful without phoning home

- Static legal glossary shipped at `public/glossary/v1.json`, surfaced
  via the existing hover-tooltip. (Phase 14)
- i18n scaffold: externalize UI strings, ship an English baseline, wire
  a locale picker. (Phase 14)
- OCR language picker — activates once a second `*.traineddata.gz`
  lands in `public/ocr/`. (Phase 14)

### Tech debt — keep the codebase honest

- Parser-side paragraph-index tracking for sections (currently
  reconstructed downstream).
- Decompose `App.tsx` (~1170 lines) into per-panel containers around
  the `usePipeline` hook.
- Fix reanalyze-staleness so `activeRules` is captured at render time,
  not re-read when the callback fires.

See [`BACKLOG.md`](./BACKLOG.md#cross-cutting-tech-debt) for the full
list.

### Risk register — review before 1.0

Tracked in [`BACKLOG.md`](./BACKLOG.md#known-unknowns--risk-register):
tesseract licensing audit, archive-format security review, release /
versioning policy, crash-log privacy review, CSP regression tests,
rule-pack rot review.

---

## Forward phases (15+)

These are the next coherent moves given what's already built. They're
deliberately scoped; speculative scope is listed under "Out of scope."

### Phase 15 — Collaboration escape hatches

The product is aggressively single-device today. Users still need to
hand a lease to a co-tenant, a lawyer, or a counterparty. Phase 15
keeps the local-first contract intact while making that handoff less
painful than "email a ZIP."

- **Signed review links** — an encrypted, time-bounded archive
  (passphrase + expiry) that opens in any other LeaseGuard instance
  with the same pack version and replays as a read-only view. Builds
  on the replay-bundle exporter and signed-report primitives.
- **Counter-sign-and-return flow** — recipient can accept / reject
  individual redline edits, sign the result with their own key, and
  export a patch that the original author's copy can apply. Reuses
  `RedlineEdit` + version-history plumbing.
- **Delta packets** — instead of re-sending the whole lease, export
  just the diff between two version-history entries as a signed JSON
  the other side can verify against their copy's `inputHash`.
- **Share-link privacy review** — explicit doc in
  [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) covering what's inside the
  encrypted archive and what isn't (no telemetry, no key escrow, no
  network).

### Phase 16 — Multi-lease intelligence

The portfolio grid shipped in Phase 11 makes the library visible.
Phase 16 makes it analytical.

- **Portfolio-wide rule rollups** — "12 of 18 leases have auto-renewal;
  4 waive jury trial" with drill-through to the individual findings.
  Extends the `PortfolioPanel`.
- **Clause similarity across leases** — shingled / normalized hashing
  to cluster near-identical clauses across the library; useful for
  "which of my leases share this bad indemnification paragraph."
- **"My standard" clause suite** — promote any clause from any lease
  into a named standard; compare future leases against the suite the
  way rule findings are currently surfaced.
- **Portfolio-level rule overrides** — extend the per-user severity
  override model so a tenant can say "treat this rule as High across
  my whole portfolio" without re-declaring it per lease.

### Phase 17 — Trust infrastructure

Phase 10 shipped signed packs. Phase 12 shipped signed reports. Phase
17 turns those primitives into an ecosystem a third party can audit.

- **Offline pack marketplace** — a curated, build-time-bundled static
  directory of packs with publisher keys, install-with-one-click,
  verified-author badges from Phase 10, and a visible pack-diff view
  before adoption.
- **Diff-vs-verified warnings** — if a user edits a signed pack (or
  imports an unsigned one derived from a signed one), show an explicit
  "this deviates from the verified baseline" warning in the
  findings and report views.
- **Reproducibility CLI** — package the deterministic `analyze` +
  replay-bundle format as a Node CLI (no browser, no network) so
  auditors can verify `{inputHash, rulePackVersion, findings}` from
  the command line. Shares its test fixtures with the in-app
  `reproducibility.test.ts`.
- **Key-rotation workflow** — UX for rotating a user's signing key
  without invalidating historical audit-log entries (hash chain
  stays intact; new entries signed with the new key; old entries
  remain independently verifiable).

---

## Out of scope (still)

- Cloud sync, accounts, team collaboration — would violate the
  local-first contract. The escape hatch is the user-initiated
  encrypted archive (Phase 4 / Phase 15).
- Telemetry or analytics of any kind, including "anonymous."
- Runtime LLM inference over the network. Build-time generation of
  static content by the maintainer is fine (Phase 14); a live API
  call is not.
- Jurisdiction-specific legal *advice*. Jurisdiction-tagged rules
  (Phase 10) surface clauses, not conclusions.
- Anything that requires a backend service to work.
