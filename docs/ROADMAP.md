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

| Phase | Theme                          | Status                                                                                                                             |
| ----- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundations                    | Done                                                                                                                               |
| 1     | PDF Parser (MVP core)          | Done                                                                                                                               |
| 2     | Rules Engine                   | Done                                                                                                                               |
| 3     | UI                             | Done                                                                                                                               |
| 4     | Local Storage                  | Done                                                                                                                               |
| 5     | Compare & OCR                  | Done                                                                                                                               |
| 6     | Polish & Distribution          | Done                                                                                                                               |
| 7     | Observability & hygiene        | Done                                                                                                                               |
| 8     | Structured lease understanding | Done                                                                                                                               |
| 9     | Negotiation support            | Done                                                                                                                               |
| 10    | Rule ecosystem                 | Done                                                                                                                               |
| 11    | Workflow & integrations        | Done                                                                                                                               |
| 12    | Trust & verification           | Done                                                                                                                               |
| 13    | Performance & scale            | Done                                                                                                                               |
| 14    | Content depth                  | Done — Wave 11 shipped static glossary, i18n scaffold (en + es stub), OCR language picker                                          |
| 15    | Collaboration escape hatches   | Done — Wave 9 shipped review links, counter-sign, delta packets, CLI verifier                                                      |
| 16    | Multi-lease intelligence       | Done — Wave 10 shipped portfolio rule rollups, clause similarity (IDB v5), "my standard" suite, portfolio-scope severity overrides |
| 17    | Trust infrastructure           | Done — Wave 8 shipped marketplace, deviation warnings, repro CLI, key rotation                                                     |

---

## Open work, grouped by destination

The roadmap below is organized by where the product is heading, not by
phase number. Each bullet points to the backlog section that tracks the
tickets.

### Tech debt — keep the codebase honest

App.tsx decomposition closed in Waves 17–21: 12 hooks + 5 sub-components
extracted; App.tsx now sits at 541 lines (below the ~600 target).

See [`BACKLOG.md`](./BACKLOG.md#cross-cutting-tech-debt) for the full
list.

### Risk register — review before 1.0

Tracked in [`BACKLOG.md`](./BACKLOG.md#known-unknowns--risk-register).
Wave 11-D closed the encrypted-archive security review, crash-log
privacy review, CSP regression tests, and rule-pack rot review (see
[`SECURITY.md`](./SECURITY.md)). Wave 14-C closed the release /
versioning policy — see [`RELEASING.md`](./RELEASING.md) for bump
rules and `SECURITY.md` §6 for the signed-format compatibility
contract.

---

## Forward phases (15+)

These are the next coherent moves given what's already built. They're
deliberately scoped; speculative scope is listed under "Out of scope."

### Phase 15 — Collaboration escape hatches (shipped, Wave 9)

Phase 15 turned LeaseGuard's signing + replay primitives into a way to
hand a lease to a co-tenant, lawyer, or counterparty without breaking
the local-first contract. See [`REPRODUCIBILITY.md`](./REPRODUCIBILITY.md)
and the "Collaboration escape hatches" section of
[`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md).

- **Signed review links** (`.lgreview`) — AES-GCM-256 + PBKDF2-SHA256
  (250k iter) envelope wrapping a replay bundle, plus an in-app
  `OpenReviewPanel` that mounts the lease in a read-only review mode
  via `useReviewMode`.
- **Counter-sign-and-return** (`.lgpatch`) — `redlinePatch.ts` signs
  per-edit accept/reject decisions with the recipient's Ed25519 key;
  the original author's `applyPatch.ts` verifies and writes one
  `patch-applied` audit entry.
- **Delta packets** (`.lgdelta`) — `deltaPacket.ts` emits a signed
  line-diff between two `LeaseVersion` records; `applyDelta.ts`
  verifies, hash-checks `baseInputHash`, applies, and re-runs analyze.
- **Privacy review + CLI verifier** — `leaseguard open-review` extracts
  a `.lgreview` from outside the browser using the same envelope shape;
  `SYSTEM_DESIGN.md` documents the privacy contract (no telemetry, no
  key escrow, no IDB dump beyond the chosen lease, no network).

### Phase 16 — Multi-lease intelligence (shipped, Wave 10)

The portfolio grid shipped in Phase 11 made the library visible. Wave 10
made it analytical. See "Multi-lease intelligence" in
[`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md).

- **Portfolio-wide rule rollups** — `app/src/portfolio/ruleRollups.ts`
  aggregates findings across the library with severity-override
  resolution; `PortfolioRollupsPanel` renders a sortable table with
  drill-through filtering of the existing grid by `leaseIds[]`.
- **Clause similarity across leases** — `app/src/portfolio/shingles.ts`
  (5-shingles + Jaccard) and `clauseClusters.ts` cluster
  near-identical paragraphs across the library at threshold ≥ 0.8.
  IDB v5 adds a `paragraphShingles` store keyed by
  `[leaseId, paragraphIndex]`, populated lazily on first
  similarity-panel render.
- **"My standard" clause suite** — `app/src/clauseStandard/standardSuite.ts`
  owns a new `leaseguard-standards` v1 IDB; FindingsPanel gains an
  optional "Promote to standard" button; `compareToStandard.ts`
  surfaces matches above 0.8 against the suite. Audit kinds
  `standard-promote` / `standard-delete`.
- **Portfolio-level rule overrides** — `portfolioOverrides.ts`
  introduces a `scope: 'lease' | 'portfolio'` discriminator. Resolution
  order: lease > portfolio > pack default. Encoded as a sibling
  `severityOverridesByLease` SETTINGS key — no IDB schema bump.

### Phase 17 — Trust infrastructure (shipped, Wave 8)

Phase 10 shipped signed packs. Phase 12 shipped signed reports. Wave 8
turned those primitives into an ecosystem a third party can audit. See
[`REPRODUCIBILITY.md`](./REPRODUCIBILITY.md) for the auditor walk-through.

- **Offline pack marketplace** — curated `.lgpack.json` files under
  `app/public/packs/curated/`, each Ed25519-signed at build time;
  in-app `MarketplacePanel` lists them with verified badge + diff
  preview + one-click install.
- **Diff-vs-verified warnings** — `packBaseline.ts` resolves each
  active rule against its signed baseline; deviations carry through
  `Finding.deviation` to the badge in `FindingsPanel` and the
  `deviations[]` field in the signed export envelope.
- **Reproducibility CLI** — `cli/` workspace ships `leaseguard-verify`,
  a node-only command that extracts a replay bundle, re-runs
  `parseLease` + `analyze`, and exits 0 on byte-identical match (1 on
  mismatch with a diff). Shares fixtures with the in-app reproducibility
  test.
- **Key-rotation workflow** — `signingKeys.ts` v1→v2 migration
  introduces a multi-key store with `rotateKey` / `listKeys` /
  `getActiveKey`; audit entries record `signedByKeyId` and the hash
  chain stays intact across rotations (retired keys remain
  verification-only).

### Phase 18 — Hybrid rules + on-device LLM clause classification

**Status:** shipped across **Waves 21–25** (PRs #82–102 + the Wave
26-A flow tests). End-to-end path: feature flag (`?phase18=on`) →
asset downloader (`npm run build:classifier-assets`) → upload-path
classifier pass → `Finding.evidence` payload → click-to-explain
badge → `llm-classify` audit entry → CSP allowance for `wasm-unsafe-eval`.
Real-model golden case lives in `tests/e2e/hybrid-golden.spec.ts`,
gated behind `RUN_REAL_MODEL=1` until a nightly job is wired
(Wave 27 candidate).

The rules engine catches paraphrased risks unevenly. Regex pins
auto-renewal language with `\bauto[- ]?renew\b` confidently, but
keyword-proximity matchers still miss commercial leases that say
"this Agreement shall continue in force from term to term until
terminated" — same hazard, different surface phrasing. The Wave 11
golden-test runs surfaced this as a recurring blind spot. Rather
than chasing every paraphrase with another regex, Phase 18 pairs the
rules engine with an on-device classifier that runs in the same
local-first contract: a small model loaded via WASM / WebGPU,
precached by the existing service worker, no network egress.

The Tesseract precedent (Phase 5: ~8 MB WASM runtime + 10 MB
language data, lazy-loaded, opt-in) is the template — same
constraints (CSP `default-src 'self'`, same-origin asset serving,
Workbox precache, "first run after manual data drop"). The
classifier targets paragraph-level risk classification, not full
clause generation; the rules engine remains authoritative for
deterministic finding ids and audit-log attestation, with the LLM
as a tie-breaker on low-confidence regex/proximity matches.

Candidate features (Wave 16-C drafted up to 8 stories under this
phase in `docs/BACKLOG.md`; nothing on the "Ready" track yet):

- Bundle-size budget for the model (cap on precache delta).
- Hybrid `analyze()` path: regex/proximity first; LLM only when
  confidence < threshold (token-budget guard).
- Per-finding evidence attestation (`Finding.evidence: { tokens,
modelId }`) recorded in the audit log.
- Offline-correctness contract: model precached alongside the rest.
- WebGPU → WASM → "LLM unavailable" graceful fallback chain.
- Privacy disclosure update.
- Paraphrased-clause golden-test fixture exercising the full path.

### Phase 19 — Phase 18 productionization

Original Wave 27 candidates, status as of Wave 43:

- **Nightly real-model GHA job** — **shipped (Wave 32-A, #135).**
  `hybrid-golden.spec.ts` runs nightly; Wave 25-class loader/CSP
  gaps would now be caught within a day.
- **Worker-path classifier** — **deferred (Phase 18 hold, see
  Wave 40 below).** Embedding pass still runs on the main thread
  after the worker returns deterministic findings; deferred until
  there's evidence Phase 18 produces user value (re-evaluation
  trigger documented in `docs/plans/wave40-phase18-revisit-or-retire.md`).
- **Click-to-explain → audit-log linkage** — **shipped
  (Wave 32-C, #136).** Disclosure surfaces the matching
  `llm-classify` entry id alongside the evidence payload.
- **Branches ≥ 90 push** — **shipped (cumulative through
  Wave 43, #160).** Coverage floor now `96 / 90 / 93 / 96`;
  branches actuals at 90.47 with the Wave 43 ratchet.
- **`@xenova/transformers` upstream-bump watch** — **superseded
  by Wave 36 migration (#149-#155).** Project moved to
  `@huggingface/transformers` v4 (default since Wave 36-B);
  v2 branch and the `protobufjs <7.5.5` accept-risk decision
  removed in Wave 36-C.

### Phase 18 status (post-Wave-40)

Phase 18 (hybrid rules + on-device LLM clause classification) is
**held** as of Wave 40 (#159). Decision: keep the gated, opt-in
classifier shipped (no removal, no rip-out cost) but pause further
productionization investment until a re-evaluation trigger fires.
Trigger criteria are documented in
`docs/plans/wave40-phase18-revisit-or-retire.md` §6 — primarily
sustained user feedback rate showing hybrid findings provide
incremental value beyond deterministic rules. Until then, the
worker-path classifier and any further hybrid-quality work stay on
the shelf.

### Phase 19 status (post-Wave-43)

Adjacent productionization items that *did* ship outside Phase 18:

- **WCAG 2.1 AA** — closed (Wave 41, #161). Story-driven axe sweep
  in `src/ui/__tests__/all-stories.a11y.test.tsx` covers every
  Storybook story; Lighthouse a11y score = 1.00 (gate ≥ 0.95).
- **Coverage floors** — `96 / 90 / 93 / 96` (Wave 43, #160).
- **Tauri matrix** — retired (Wave 42, #157). PWA stays the
  single shipping surface; native shell is out of scope.
- **Bundle budget** — re-audited (Wave 38, #158). Classifier
  ORT subdirectory excluded from the bundle walk in Wave 39 (#162).
- **CI trust** — ~~Mergify~~ queue gap closed (Wave 30-C, confirmed
  in Wave 37 #154).

---

## Out of scope (still)

- Cloud sync, accounts, team collaboration — would violate the
  local-first contract. The escape hatch is the user-initiated
  encrypted archive (Phase 4 / Phase 15).
- Telemetry or analytics of any kind, including "anonymous."
- Runtime LLM inference over the network. Build-time generation of
  static content by the maintainer is fine (Phase 14); a live API
  call is not.
- Jurisdiction-specific legal _advice_. Jurisdiction-tagged rules
  (Phase 10) surface clauses, not conclusions.
- Anything that requires a backend service to work.
