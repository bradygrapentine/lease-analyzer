# Wave 11 — Content depth + risk-register cleanup

**Goal:** finish the open Phase 14 (content depth) tickets — static
glossary, i18n scaffold, OCR language picker — and burn down the
risk-register items that have been deferred since Phase 7 (crash-log
privacy summary, CSP regression test, archive-format security review,
rule-pack rot review). After Wave 11, ROADMAP shows Phase 14 fully
done and the risk register is either resolved or has a dated decision
recorded for each item.

## Scope boundary vs. Wave 10

Wave 11 touches `app/src/i18n/` (new), `app/public/glossary/` (new),
`app/src/ocr/` (extends `runOcr`), `app/src/diagnostics/` (extends),
`app/scripts/check-csp.mjs` (new), `app/src/rules/packV1.ts` (rot
review only — no behavior changes outside docstrings + new tests),
and `docs/SECURITY.md` (new). It does NOT touch `app/src/portfolio/`,
`app/src/clauseStandard/`, or `PortfolioPanel`. Both waves edit
`docs/ROADMAP.md` + `docs/BACKLOG.md` in disjoint sections (Wave 11 →
Phase 14 + risk register; Wave 10 → Phase 16). App.tsx wire-up is at
the top-level provider boundary (i18n) + header (locale picker), not
inside view-mode regions Wave 10 owns.

## Pre-flight

1. Wave 9 fully merged; ROADMAP shows Phase 15 Done. (Wave 10 does
   NOT need to be merged — branches from the same `main` SHA.)
2. `cd app && npm run typecheck && npm run lint && npm test` is green
   on `main`.
3. The CSP contract in `index.html` is `default-src 'self'`. Any
   regression Wave 11 introduces here is a release-blocker.
4. No new dependencies. All four parts use only existing tooling
   (vite, vitest, WebCrypto). The i18n part hand-rolls a tiny
   `formatMessage(key, params)` rather than pulling in `react-intl`.

## Parts (parallel-safe)

### Part A — Static legal glossary v1

**Branch:** `wave11-glossary`

**Files:**
- `app/public/glossary/v1.json` (new) — schema
  `leaseguard.glossary.v1`: `{ schema, version, entries: { term,
  definition, sources?: string[] }[] }`. Seed with 30–50 terms
  drawn from the 10 v1 rules + common defined-terms (rent abatement,
  CAM, holdover, indemnify, etc.). Plain-English; no jurisdiction
  claims.
- `app/src/glossary/loadGlossary.ts` (new) — `fetch('/glossary/v1.json')`
  with same-origin guard + schema validation; cached after first call.
  This is the ONE allowed `fetch` and it's same-origin to a static
  asset; document the exception in the module header.
- `app/src/glossary/loadGlossary.test.ts` (new) — happy path, malformed
  JSON, schema-violation rejection, fetch-failure fallback to empty.
- `app/src/ui/highlightDefinedTerms.ts` — accept an optional
  `glossary?: GlossaryEntry[]` and surface tooltips for matched terms
  in addition to lease-defined terms. Default undefined preserves
  current behavior.
- `app/src/ui/highlightDefinedTerms.test.ts` — extend with glossary
  cases.
- `app/src/App.tsx` — load the glossary once at mount; thread to
  `FindingsPanel`'s `definitions` consumer (or as a sibling prop).
- `docs/RULES.md` — short subsection on the glossary schema for
  maintainers.

**Tests / verify:** glossary is loaded exactly once per session;
malformed JSON does not crash the app; tooltip renders for both
lease-defined and glossary-defined terms; no CDN URLs introduced.

**Out of scope:** glossary versioning (only v1 this wave); user-editable
glossary; per-jurisdiction glossary entries.

### Part B — i18n scaffold (en baseline + one stub locale)

**Branch:** `wave11-i18n`

**Files:**
- `app/src/i18n/messages.ts` (new) — typed `Messages` record + `en`
  baseline covering all currently-rendered UI strings (panel titles,
  button labels, common errors). Keep keys flat (`findings.empty`,
  `pack.import.success`).
- `app/src/i18n/messages.test.ts` (new) — every key in `en` has a
  string value; key set matches the `Messages` type via
  `satisfies Messages` + a runtime parity check.
- `app/src/i18n/locales/es.ts` (new) — Spanish stub; partial coverage
  is acceptable; missing keys must fall back to `en`.
- `app/src/i18n/I18nProvider.tsx` (new) — React context exposing
  `t(key, params?)`. Locale read from `localStorage.leaseguard.locale`
  with `'en'` default.
- `app/src/i18n/I18nProvider.test.tsx` (new) — provider renders, locale
  switch updates `t`, missing key falls back to `en`, missing key in
  both logs once and returns the key string.
- `app/src/ui/LocalePickerPanel.tsx` (new) + `.test.tsx` + `.stories.tsx`
  — picker renders in the header; persists to localStorage.
- `app/src/App.tsx` — wrap the existing tree in `<I18nProvider>` at the
  top of `App`; mount `LocalePickerPanel` in the header next to the
  existing nav. Replace 6–10 hardcoded strings with `t(...)` calls in
  `App.tsx` itself as a representative seed; full panel migration is
  a Phase 14 follow-up explicitly listed in BACKLOG.
- `docs/SYSTEM_DESIGN.md` — short "i18n" subsection covering the
  fallback chain and the localStorage key.

**Tests / verify:** locale switch survives reload; `en` baseline is
typecheck-complete; `es` stub falls back without throwing; no new
deps in `package.json`.

**Out of scope:** RTL layout support; date/number formatting library
(continue using `toLocaleDateString`); pluralization rules; full
panel-by-panel string migration.

### Part C — OCR language picker

**Branch:** `wave11-ocr-language`

**Files:**
- `app/src/ocr/availableLanguages.ts` (new) — `discoverOcrLanguages():
  Promise<{ code: string; label: string }[]>` that fetches a static
  manifest at `/tesseract/languages.json` (same-origin) listing which
  `*.traineddata.gz` files the user has dropped in. Empty array if the
  manifest is missing.
- `app/public/tesseract/languages.json` (new) — seed with `[{ code:
  "eng", label: "English" }]`; document in
  `app/public/tesseract/README.md` how to add a language by dropping a
  `traineddata.gz` and appending an entry.
- `app/src/ocr/availableLanguages.test.ts` (new).
- `app/src/ocr/runOcr.ts` — accept `language?: string` (default
  `'eng'`); pass through to tesseract.js. Existing callers unchanged.
- `app/src/ocr/runOcr.test.ts` — extend with language plumbing tests
  (mock the worker boundary; do not load real wasm in jsdom).
- `app/src/ui/OcrLanguagePickerPanel.tsx` (new) + test + story —
  rendered next to the existing OCR banner; if only one language is
  available, render as a static label rather than a picker.
- `docs/SYSTEM_DESIGN.md` — extend the existing OCR subsection with
  the manifest contract and the same-origin guarantee.

**Tests / verify:** picker hidden when manifest is empty/missing;
picker selection threads through to `runOcr`; no fetches outside
`/tesseract/`.

**Out of scope:** auto-download of language data from any remote;
RTL-language UI handling; multi-language single-document OCR.

### Part D — Risk-register cleanup

**Branch:** `wave11-risk-register`

**Files:**
- `app/scripts/check-csp.mjs` (new) — Node script that reads
  `app/dist/index.html` + `app/dist/sw.js` post-build and asserts no
  third-party origins appear in `<script>`/`<link>`/`<img>`/CSS
  `url(...)`/`importScripts(...)` patterns. Exit 1 with a clear diff
  on regression.
- `app/scripts/check-csp.test.mjs` (new) — happy + regression fixtures.
- `app/package.json` — `"check:csp": "node scripts/check-csp.mjs"`
  added; CI workflow extended to run it after `npm run build`.
- `app/src/diagnostics/diagnosticsReport.ts` — emit a new
  `summary: string[]` field listing every category included
  (e.g. `["userAgent", "stack-traces (last 20)", "rule-pack versions",
  "no PDF bytes", "no IDB contents"]`). UI: surface this list above
  the download button.
- `app/src/ui/DiagnosticsPanel.tsx` (or wherever the download lives)
  — render the summary; add a test asserting summary lines appear.
- `docs/SECURITY.md` (new) — document: (1) encrypted-archive threat
  model (PBKDF2 200k iterations as of 2026; explicit decision to defer
  Argon2id with revisit date `2026-10-01`); (2) crash-log contents
  (per the new summary field); (3) CSP contract + the new
  `check:csp` gate; (4) rule-pack rot review schedule.
- `app/src/rules/packV1.test.ts` — add a "rot review" test block: each
  v1 rule must have non-empty `plainEnglish` and `suggestedEdit`; this
  freezes the audit pass and surfaces drift if a future edit drops
  either field.
- `docs/BACKLOG.md` — under "Known unknowns & risk register": each
  item ticked or annotated with `Decision: <one line> (2026-04-25)`.

**Tests / verify:** `npm run build && npm run check:csp` is green on
clean main and fails on a planted CDN URL; diagnostics export contains
the new summary field; v1 rule rot test passes.

**Out of scope:** Argon2id implementation (decision deferred with
date); external security audit (out of project scope); automated
license-scanning of `node_modules`.

## Merge order

All four parts are fully independent. Suggested: **A & D in parallel
first** (smallest blast radius), then **B & C in parallel**. B touches
App.tsx top-level wrap; C touches App.tsx for the OCR-banner area —
the two regions don't overlap, but if a conflict arises B merges first
(provider must exist before C's panel can call `t(...)`).

## TDD recommendation

Run as `/tdd-wave 11`. Parts A and D are spec-shaped (schema validation,
CSP regression assertions); spec-first prevents implementer drift on
the JSON shapes. Parts B and C are mostly straightforward RTL.

## Done definition

- All four PRs merged.
- ROADMAP Phase 14 marked Done; risk register either resolved or has
  a dated decision per item.
- BACKLOG: every Phase 14 row checked; risk-register section reduced
  to dated decisions; new "Wave 11" rollup section added (mirroring
  Wave 7/8/9 sections) with all four parts ticked.
- `docs/SECURITY.md` exists with the four documented sections.
- `npm run check:csp` runs in CI after build.
- Privacy contract re-affirmed: only allowed fetches are same-origin
  to `/glossary/v1.json` and `/tesseract/languages.json`.
