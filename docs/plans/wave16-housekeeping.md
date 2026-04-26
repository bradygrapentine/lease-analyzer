# Wave 16 — Housekeeping

**Goal:** broad-but-bounded hygiene pass after the Wave 14/15 cluster.
Six tracks chosen by the human ask, each scoped to one PR with a hard
cap so the wave is shippable in a session, not a refactor without a
floor. No new product surface. No schema bumps. No new audit `kind`
strings. Anything that grows past its cap rolls to Wave 17 explicitly,
not silently.

## Scope boundary

Wave 16 owns:

- `app/vite.config.ts` (coverage thresholds), `app/src/**/*.test.ts(x)`
  (Part A new tests), `tests/e2e/*.spec.ts` (Part B new flows),
  `app/playwright.config.ts` (Part B if a new project entry needs it).
- `docs/BACKLOG.md` (Part C only — single writer to avoid conflicts),
  `docs/ROADMAP.md` (Part C — Phase 18+ outline), `docs/SETUP.md` (NEW,
  Part D), `docs/CONTRIBUTING.md` (NEW, Part D), `README.md` (Part D
  only).
- Targeted source files Part E identifies up to its cap (see Part E
  scope — must be listed in the PR description, no silent broadening).
- `docs/SECURITY.md` (Part F), `.github/workflows/security.yml` (Part F
  if `harden-project` finds gaps), `app/package.json` (Part F if a dep
  has a known CVE that needs a pin bump — exact pinned version listed
  in the PR body).

Wave 16 does **NOT** touch:

- Any `app/src/parser/`, `app/src/rules/`, `app/src/storage/`,
  `app/src/audit/`, `app/src/security/signing*` source files outside of
  test additions (Part A) — behavior changes are not in scope. If a
  test reveals a real bug, file a row in `docs/BACKLOG.md` and skip the
  fix to a follow-up wave; do not fold it into Wave 16.
- IndexedDB schema (no DB version bump in any part).
- New product UI (no new panels, no new buttons, no new views).
- `docs/CLAUDE.md` (separate `claude-md-management` skill owns that).

## Pre-flight

1. Wave 14 (A/B/C/D) and Wave 15 (C/D) merged. Wave 15-A and 15-B were
   already-shipped pre-Wave-15 (reconciled via PR #55). Wave 16 starts
   from `main` at or after `79c6935`.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green (post PR #58).
3. Read the per-part **cap** before starting that part. The cap is the
   contract. If the cap is hit before the work feels "done," ship what's
   in scope and roll the rest into Wave 17. Do not negotiate the cap up
   from inside the part.
4. Confirm `docs/BACKLOG.md` has no open `Status: ⚡ In progress` rows
   that would conflict with Part C's appendix. (Today: none — Wave 15
   reconciliation is done.)

## Parts (parallel-safe, single-writer per file)

### Part A — Unit-test coverage push

**Branch:** `wave16-coverage-push`

**Cap:** branches threshold goes from **87 → 90** (not higher). At
most **15** new test files / `.test` blocks. No production-source
edits.

**Files (test-only):**

- `app/vite.config.ts` — bump `branches` floor from `87` to `90` once
  the new tests pass at >= 90.5 to leave headroom.
- New test files under `app/src/**/*.test.ts(x)` for the bottom-quartile
  branch-coverage modules. Identify with
  `npm run test:coverage -- --coverage.reporter=json-summary` and pick
  the lowest-coverage modules until 90 is cleared. Likely candidates
  (verify before adding):
  - `app/src/workflow/buildIcs.ts` (94.59% branches — close, may not
    be worth a test)
  - `app/src/workflow/copySummary.ts` (85.71% branches — likely
    candidate)
  - `app/src/parser/extractDefinedTerms.ts` (89.18% branches)
  - `app/src/security/secureClipboard*.ts` if present (likely
    candidate; touchy area)
  - `app/src/observability/*.ts` (under-tested historically)
- `docs/TESTING.md` — bump the documented threshold line.

**Tests / verify:**

- `npm run test:coverage` reports branches >= 90.5 (vitest enforces the
  90 floor; 0.5 buffer absorbs variance).
- `npm run typecheck && npm run lint` green.
- No production-source diff in this PR (`git diff main..HEAD -- 'app/src/**/*.ts' 'app/src/**/*.tsx' ':!*.test.ts*' ':!*.stories.*'` empty).

**Out of scope:** functions/lines/statements thresholds (already
above target); 100% coverage; behavior changes from "I noticed a bug
while writing the test." If a test surfaces a real bug, file a BACKLOG
row in Part C and *skip* the affected test with a `// TODO(wave-17):
covers buggy behavior, see BACKLOG row XYZ`.

### Part B — Component + E2E user-flow tests

**Branch:** `wave16-e2e-flows`

**Cap:** at most **3 new Playwright spec files**, **2 new RTL component
tests**. No new Storybook stories. No production-source edits.

**Files:**

- `tests/e2e/compare.spec.ts` (NEW) — pick a saved standard, upload a
  second lease, assert the compare panel mounts with at least one
  `added`/`removed`/`changed` row.
- `tests/e2e/redline.spec.ts` (NEW) — open a finding, accept the
  suggested edit, assert the redline appears and persists across a
  reload.
- `tests/e2e/version-history.spec.ts` (NEW) — save a redline, save a
  version, restore that version, assert the redline state matches.
- `app/src/ui/ComparePanel.flow.test.tsx` (NEW) — hover-to-inspect on a
  changed row reveals the previous text; deep-link to the underlying
  finding works.
- `app/src/ui/PackManager.flow.test.tsx` (NEW) — toggle a pack, severity
  override changes, reanalyze fires once via the staleness guard
  (regression coverage for Wave 7-D's hook).
- `tests/e2e/README.md` — append a "User flows covered" subsection
  enumerating the 3 new specs.

**Tests / verify:**

- All new e2e specs pass on the chromium / firefox / webkit matrix from
  Wave 14-B.
- Total e2e wall time stays under 10 minutes (the cap).
- New RTL tests pass under `npm run test:coverage` without bumping the
  per-file timeout (use the existing 5s default; if a test needs more,
  the underlying flow is too coupled and belongs in e2e instead).

**Out of scope:** signing/counter-sign flow (Wave 9 already has unit +
spec coverage; e2e is hard because key generation is async); bulk
import (file-upload-with-multiple-files is an awkward Playwright path,
roll to Wave 17 if the chosen 3 fill the cap); accessibility checks
inside the new specs (Wave 14-D's `tests/e2e/a11y.spec.ts` is the
dedicated venue).

### Part C — BACKLOG + ROADMAP forward extension

**Branch:** `wave16-roadmap-forward`

**Cap:** at most **8 new BACKLOG rows** + **1 new ROADMAP phase
section** (Phase 18). No flips of existing rows beyond what falls out
of cross-referencing. No new "Wave N" sections in BACKLOG.

**Files:**

- `docs/ROADMAP.md` — add a "Phase 18 — Hybrid rules + on-device LLM
  clause classification" section. One paragraph framing the why
  (semantic clause matching where regex/proximity matchers miss
  paraphrased risks; preserves the local-first / no-egress contract by
  running a small model in-browser via WASM / WebGPU, mirroring the
  Tesseract precedent), 4-5 bullet candidate features. Mark explicitly
  as "candidate; nothing committed — model footprint and CSP impact to
  be measured before any code lands."
- `docs/BACKLOG.md` — add up to 8 rows under a new `## Phase 18 —
  Hybrid rules + on-device LLM` section, each row matching the existing
  one-paragraph prose convention. Each row's first sentence states the
  goal; second sentence states why it isn't already done; third
  sentence states what "done" looks like. Likely candidates (Part C
  picks the final 8 from this list, not all of them):
  - LLM-classifier microservice **inside the existing leaseWorker**
    (no new worker; structured-clone shape preserved).
  - Model selection + bundle-size budget gate (cap on precache delta).
  - Hybrid `analyze()` path: regex/proximity first; LLM only for
    paragraphs where confidence < threshold (token-budget guard).
  - "Why did the LLM flag this?" attestation: the model output gets a
    new `Finding.evidence: { tokens: number; modelId: string }` field
    that the audit log records.
  - Offline-correctness contract: precache the model with Workbox so
    OCR + classification both work after first load.
  - WebGPU fallback path → WASM → "LLM unavailable" banner; rules
    engine still works without the model.
  - Privacy disclosure update — add a note that classifier inputs
    never leave the device, like the existing parse / OCR disclosure.
  - Golden-test extension: a paraphrased-clause fixture where the
    rules engine misses, the LLM catches, and the audit attestation
    records why.
- No flips of existing rows.

**Tests / verify:**

- `docs/BACKLOG.md` lints cleanly under whatever markdown lint the
  pre-commit hook runs (currently `prettier --write`).
- `docs/ROADMAP.md` "Forward phases (15+)" section gains the Phase 18
  block in correct numerical order.
- `git diff main..HEAD -- docs/BACKLOG.md` shows only additions, no
  deletions / modifications to existing rows (verify with the
  `--diff-filter=AM` flag and assert the M file count is 0 outside the
  Phase 18 block — informal check, not a CI gate).

**Out of scope:** promoting candidate Phase 18 rows to "Ready" (every
row lands as `[ ]` candidate); shipping any model code (this is doc /
backlog work only — the actual model integration is its own future
wave); reorganizing existing phases.

### Part D — Human setup + contribution docs

**Branch:** `wave16-setup-docs`

**Cap:** **2 new docs** (`docs/SETUP.md`, `docs/CONTRIBUTING.md`) +
**README.md** edits to link them. Each doc <= **150 lines**.

**Files:**

- `docs/SETUP.md` (NEW) — exact onboarding sequence for a fresh clone:
  Node version (use `.nvmrc` if present, else state `20.x`), repo-root
  `npm install` (husky), `cd app && npm install`, optional
  `npm run e2e:install`, optional `eng.traineddata.gz` drop for OCR.
  One troubleshooting subsection for the three known foot-guns:
  pre-commit hook not installed, OCR data missing, Tauri build failing
  on macOS without Xcode CLT.
- `docs/CONTRIBUTING.md` (NEW) — the contributor's flow: branch naming
  convention (`waveN-<slug>` / `fix/<slug>`), pre-commit gate, the
  required local sequence (`typecheck && lint && test:coverage` and
  `check:budget` for any UI/build-affecting change), how to open a PR,
  how the auto-merge gate fires, what NOT to land (binary fixtures,
  CDN-hosted assets, audit-kind strings without a doc edit).
- `README.md` — add a "Getting started" stub linking to
  `docs/SETUP.md`, and a "Contributing" stub linking to
  `docs/CONTRIBUTING.md`. Do not duplicate content — the README points,
  the docs hold.

**Tests / verify:**

- `prettier --check docs/SETUP.md docs/CONTRIBUTING.md README.md` clean.
- Every command shown in `docs/SETUP.md` is one I can paste into a
  fresh shell and run successfully (manual verification step listed in
  the PR description).
- Every link in `README.md` resolves (manual click-through; could add
  `lychee` later but not in this part).

**Out of scope:** rewriting the existing README narrative; adding
screenshots; writing a deploy guide (we ship as a PWA — there is no
deploy story beyond `npm run build`); writing per-platform setup
(Windows / WSL is fine to skip; doc is best-effort macOS + Linux,
flagged at the top).

### Part E — Tech debt triage + targeted cleanup

**Branch:** `wave16-tech-debt-triage`

**Cap:** at most **5 source files modified**, **0 new files**, **no
behavior changes** (the diff is suppressions removed / dead code
deleted / line-count reductions only). Anything that needs a real fix
goes to a BACKLOG row, not into this part.

**Files (audit + selective edits):**

- Read every existing `// eslint-disable*` in
  `app/src/**/*.{ts,tsx}` (excluding `*.stories.tsx` and `*.test.*`).
  For each: confirm the suppression is still load-bearing or remove it.
  Today (2026-04-25): `app/src/App.tsx:194` and `:298` are the two
  production-code suppressions worth a look.
- Search for dead code under `app/src/`: exports that have zero
  importers, types that have zero references, helpers replaced by
  later refactors. Use `npx ts-unused-exports tsconfig.json` if
  available; else manual grep on a short list of suspected files. Cap
  the deletions at the 5-file budget.
- Walk the BACKLOG `[~]` partial rows and the "Cross-cutting tech debt"
  section. For each, **either** add a precise BACKLOG row in Part C's
  PR (Part E itself does not edit BACKLOG to keep the single-writer
  rule) **or** confirm the deferred reason is still valid.
- File a Wave 17 candidate row in Part C for App.tsx decomposition
  (currently 1007 lines vs. the BACKLOG row's <= 600 target).

**Tests / verify:**

- `npm run typecheck && npm run lint && npm run test:coverage` green
  with no threshold drop.
- `git diff main..HEAD --shortstat` shows net negative line count (the
  whole point of this part is reducing surface area, not adding it).
- The PR description enumerates each file modified and the specific
  suppression / dead-code item removed.

**Out of scope:** App.tsx decomposition (rolled to Wave 17); rewriting
existing modules for clarity ("cleanup" is removal, not replacement);
introducing new abstractions that would justify the deletion (deletion
without replacement is the contract).

### Part F — Security review pass

**Branch:** `wave16-security-pass`

**Cap:** at most **3 source-file edits**, **1 dep-pin bump**, **1
workflow file** (`.github/workflows/security.yml` if missing
scanners are surfaced). Anything beyond → Wave 17.

**Files (audit-driven):**

- Run `npm audit` at the repo root and inside `app/`. For any HIGH /
  CRITICAL CVE on a direct dep, pin to the patched version. Do not bump
  transitive-only HIGHs without a path; file a BACKLOG row instead.
- Re-audit the OWASP-top-10 surface that LeaseGuard actually touches:
  - **A01 Broken Access Control** — n/a (no server)
  - **A02 Cryptographic Failures** — recheck Ed25519 key handling in
    `app/src/security/signingKeys.ts`, AES-GCM archive in
    `app/src/storage/archive.ts`. Diff against last review (Wave 8-D).
  - **A03 Injection** — recheck the redline-edit HTML pipeline
    (`app/src/storage/exportHtml.ts`) for XSS regressions; recheck
    `dangerouslySetInnerHTML` callers (should be zero).
  - **A05 Security Misconfiguration** — recheck CSP via
    `app/scripts/check-csp.mjs` output and `app/index.html`'s `<meta
    http-equiv="Content-Security-Policy">`. Confirm no `unsafe-inline`
    /  `unsafe-eval` / external origins added since Wave 12-A.
  - **A06 Vulnerable Components** — covered by the npm audit step above.
  - **A08 Software & Data Integrity** — confirm
    `app/src/security/inputHash.ts` SHA-256 path is still the only
    hashing source for content addressing.
- `docs/SECURITY.md` — bump the "Last review" date to 2026-XX-XX (PR
  draft date) and document any deltas found.
- `.github/workflows/security.yml` — if missing scanners (gitleaks,
  trivy fs, osv-scanner, npm audit) per the `harden-project` skill,
  add only the ones that aren't already there. Do not duplicate.

**Tests / verify:**

- `npm audit --audit-level=high` returns zero direct-dep findings.
- `npm run check:csp` (if the script exists) green.
- The new / updated workflow runs successfully on the PR.
- `docs/SECURITY.md` "Last review" date updated and any new finding
  recorded.

**Out of scope:** rotating Ed25519 keys (that's a user action, not a
code change); migrating from PBKDF2 to Argon2 (separate wave with a
schema-migration story); adding a SECURITY.md disclosure policy
(already present); adding a Snyk / Dependabot config (separate wave —
needs an org-level decision).

## Merge order

Disjoint-by-construction except where Part C is the single writer for
`docs/BACKLOG.md`. Suggested:

```
A, D, F  (parallel-safe; disjoint files)
   ↓
B        (depends on A's coverage thresholds being live so the new RTL
          tests don't drag overall numbers down)
   ↓
E        (depends on having Part C's BACKLOG-extension PR in flight so
          E can reference exact row IDs in its PR body when filing
          tech-debt candidates that fall outside its 5-file cap)
   ↓
C        (lands last because it absorbs the BACKLOG additions A, B, E
          want to file but cannot under the single-writer rule)
```

If Part C lands first, the other parts file their candidate rows by
adding to a TODO list in Part C's PR description and the Part C author
folds them in. Either way, only Part C writes to `docs/BACKLOG.md`.

## TDD recommendation

**Direct dispatch (parallel subagents) for A, D, F.** They're crisp,
file-scoped, and the verify steps are mechanical.

**Direct (single Opus author) for B, E.** Both have judgment calls:
which flows to e2e-test (B), which suppressions to remove (E). A
subagent without product context will guess.

**TDD escalation for C** if past plan-extension waves in this project
have produced "we added rows that contradict existing rows" friction —
not historically a problem here, so direct is fine.

## Done definition

- All six PRs merged.
- Coverage thresholds at S95 / B90 / F91 / L95 (statements/branches/
  functions/lines).
- 3 new e2e specs + 2 new RTL component flow tests, all green on the
  chromium/firefox/webkit matrix.
- `docs/BACKLOG.md` has a Phase 18 section with up to 8 candidate rows;
  `docs/ROADMAP.md` has a Phase 18 framing block.
- `docs/SETUP.md` and `docs/CONTRIBUTING.md` exist; `README.md` links
  them.
- Net source-line count is negative for Part E's diff;
  `npm run test:coverage` and `npm run lint` green.
- `npm audit --audit-level=high` clean at the repo root and in `app/`;
  `docs/SECURITY.md` "Last review" date is the wave's draft date.
- No new IDB store, no new audit `kind` string, no new product surface,
  no new dep beyond Part F's pin bump (if any).

## Hard caps summary

| Part | Cap |
|------|-----|
| A | branches 87 → 90; <= 15 new test files; 0 src edits |
| B | <= 3 new Playwright specs; <= 2 new RTL tests; 0 src edits |
| C | <= 8 new BACKLOG rows; 1 new ROADMAP phase; 0 row flips |
| D | 2 new docs (each <= 150 lines); README pointer-only edits |
| E | <= 5 src files modified; 0 new files; net-negative line count |
| F | <= 3 src edits; 1 dep-pin bump; 1 workflow edit |

If a cap is breached, ship what fits and roll the overflow to Wave 17
explicitly. Do not negotiate caps up from inside a part.
