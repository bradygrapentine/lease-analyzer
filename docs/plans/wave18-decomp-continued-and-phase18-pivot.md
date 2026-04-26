# Wave 18 — App.tsx decomposition continued + Phase 18 model pivot

**Goal:** finish the App.tsx decomposition push that Wave 17-A
deliberately left short (958 → ≤820 lines), and convert the Phase 18
LLM track from "DistilBERT is too big" into "here's the model we'd
ship and here's the budget we need." Three parts, tight caps; one
session.

## Scope boundary

Wave 18 owns:

- `app/src/App.tsx` (Part A only — single writer), `app/src/App/use*.ts`
  for the new derived-state hook extraction (Part A).
- One new sub-component file pair under `app/src/ui/` (Part A) — see
  Part A's "Approach" for which one.
- `app/src/App.test.tsx`, `app/src/App.panels.test.tsx` (Part A only)
  for any selector adjustments around the extracted JSX.
- `app/scripts/measure-llm-budget.mjs` (Part B — single writer; Wave
  17-D shipped the script, Part B extends it for multi-model runs).
- `docs/BACKLOG.md` Phase 18 row "Model selection + bundle-size budget
  gate" (Part B only — appends a comparison table + recommendation
  trailer).
- `app/vite.config.ts` and `docs/TESTING.md` (Part C only — branch
  threshold bump 88→89 contingent on Part A's actual coverage post-
  decomposition).

Wave 18 does **NOT** touch:

- IndexedDB schema, audit `kind` strings, any production source under
  `app/src/parser/`, `app/src/rules/`, `app/src/storage/`,
  `app/src/audit/`, `app/src/security/` (Part A's decomposition is
  JSX/orchestration only).
- Any LLM-runtime code in production (Part B is measurement +
  recommendation only — no `transformers.js`, no `onnxruntime-web`
  imports, no model in `app/public/`).
- New audit `kind` strings.
- Coverage threshold for statements / functions / lines (Part C only
  bumps branches, and only if Part A actually lifts the actual past
  the new floor with headroom).
- Storybook major version bump (rolls to a future maintenance wave —
  the Wave 16-F MODERATE vulns are dev-deps only).

## Pre-flight

1. Wave 17 (A/B/C/D + plan) all merged. Wave 18 starts from `main`
   at or after `893f701` (post-`wave17-C` BACKLOG refresh).
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green. CSP check green.
3. Verify `app/src/App.tsx` is still **≤ 958 lines**. If a separate
   commit has shrunk it, recompute Part A's target.
4. Confirm `app/scripts/measure-llm-budget.mjs` runs to completion on
   the current Node + npm cache. If it doesn't (network rate-limit,
   missing dep), Part B's spike-pivot becomes a separate
   investigation.
5. Read the per-part **cap** before starting that part. The cap is
   the contract. If hit before the work feels "done," ship what's
   in scope and roll the rest into Wave 19.

## Parts (parallel-safe)

### Part A — derived-state hook + one sub-component

**Branch:** `wave18-app-decomp-continued`

**Cap:** App.tsx **≤ 820 lines** (from 958; that's a 14% cut). **≤ 2
new files**: one new derived-state hook
(`app/src/App/useDerivedAppState.ts` or similar) and **at most one**
new sub-component file pair (Part A picks which sub-component is the
cleanest extract — see Approach). **Zero behavior changes.** Coverage
thresholds NOT bumped in this part (that's Part C).

**Approach:**

Wave 17-A established that further sub-component extraction past
`<AppHeader>` is blocked by tight state-coupling: every candidate
sub-component would need ≥30 props or pre-extraction of derived
state into hooks. Part A unblocks the next sub-component split by
doing the derived-state extraction first.

Step 1: extract derived state. The five-to-eight `useMemo` blocks in
App.tsx (`plainEnglishByRuleId`, `suggestedTextByRuleId`,
`sectionForParagraph`, the OCR-language picker memos, the diff-rule
input shape, etc.) move into a new
`app/src/App/useDerivedAppState.ts` hook. Inputs: the upstream
hook surfaces (`packs`, `status`, `ocrLanguages`). Outputs: a
`{ plainEnglishByRuleId, suggestedTextByRuleId, sectionForParagraph,
... }` object that App destructures. ~30-50 line drop in App.tsx.

Step 2: extract one sub-component. Two candidates Part A picks
between (whichever is cleaner once Step 1 has landed):

- **`<AppRedlinePane>`** — the entire `view === 'redline'` block
  including the redline panel, version-history `<details>`, and the
  side-letter panel. Was ~90 lines in pre-Wave-17 App.tsx; same size
  now. After Step 1's derived-state move, the prop interface should
  be ~12 callbacks + the redline / sideLetter / versionHistory hook
  surfaces (passed as a single `redlineState: RedlineStateBundle`
  prop to keep the prop count sane).
- **`<AppFooterControls>`** — the `<footer>` block at the bottom of
  App.tsx (encrypted-archive export/import + clear-all). ~30 lines.
  Smaller drop, simpler interface.

Pick **at most one**. If `<AppRedlinePane>` cleans up enough and
fits within an reasonable prop interface (≤8 props), do it. If it
still feels like a 30-prop bag after Step 1, fall back to
`<AppFooterControls>` and document why the bigger one rolled to
Wave 19.

**Files:**

- `app/src/App.tsx` — JSX edits + import the new hook + sub-component.
- `app/src/App/useDerivedAppState.ts` (NEW) — pure-ish derivation
  hook; no IDB / audit imports.
- `app/src/App/useDerivedAppState.test.ts` (NEW) — RTL `renderHook`
  cases pinning the input → output mapping for at least the three
  largest derivations.
- `app/src/ui/AppRedlinePane.tsx` (NEW, optional per cap) — or
  `app/src/ui/AppFooterControls.tsx` if the smaller one wins.
- `app/src/ui/AppRedlinePane.test.tsx` (NEW, optional) — or the
  footer-controls test, same shape as `AppHeader.test.tsx`.

**Tests / verify:**

- `git diff main..HEAD -- app/src/App.tsx | grep '^-' | wc -l` shows
  the line drop is real (not just moved into sibling files that App
  re-imports verbatim).
- All existing App.test.tsx + App.panels.test.tsx pass unchanged. If
  a test is brittle to the extracted boundary, fix the test, not the
  boundary. Public selectors (aria-labels, role names) stay stable.
- `npm run test:coverage` thresholds hold (no drops below 95/88/91/95).
- Bundle budget unchanged.

**Out of scope:** any second sub-component (rolls to Wave 19); the
final push to ≤600 lines (rolls to Wave 19); behavior changes during
decomposition; lifting any of the long imperative callbacks
(`handleBytes`, `onCompare`, `onOpenLibrary`, etc.) into hooks —
those are a separate Wave 19 concern.

### Part B — Phase 18 model pivot

**Branch:** `wave18-phase18-pivot`

**Cap:** **≤ 3 candidate models** measured. Existing
`measure-llm-budget.mjs` extended with a multi-model loop. **0
production-source edits.** **1 BACKLOG row trailer** appended (under
the existing Wave 16-C "Model selection + bundle-size budget gate"
row, after Wave 17-D's existing trailer).

**Approach:**

Wave 17-D measured DistilBERT-quantized at 65.47 MiB — 5.6× the
current precache. Phase 18 needs a smaller class. Part B measures
the candidate alternatives and writes a recommendation.

Candidates (Part B picks 2-3 from this list, justifies the picks in
the script header):

- `Xenova/all-MiniLM-L6-v2` (≈22 MiB int8) — sentence embeddings;
  paragraph similarity / classification head trains on top.
- `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (≈65 MiB)
  — DistilBERT with a binary classification head; same size class as
  Wave 17-D's measurement, included as a baseline for comparison.
- `Xenova/bge-micro-v2` (≈12 MiB) — even smaller embedding model;
  validate it can carry a useful classification signal.
- `lxyuan/distilbert-base-multilingual-cased-sentiments-student` —
  multilingual; only worth measuring if i18n is in the Phase 18 reach.
- A pure tokenizer + a hand-built lookup head (no model weights at
  all) — fallback baseline; validates the rules engine + tokenizer
  alone catches enough paraphrased clauses that Phase 18 can ship a
  zero-model first slice.

**Files:**

- `app/scripts/measure-llm-budget.mjs` — extend the existing script
  with a multi-model loop. Each model run reports the same numbers
  Wave 17-D's single-model run did (weights, tokenizer, configs,
  total, precache delta). Comparison table at the end of the run
  prints all candidates side-by-side. Script remains single-file,
  no new deps.
- `docs/BACKLOG.md` Phase 18 "Model selection + bundle-size budget
  gate" row — append a "**Compared 2026-XX-XX:**" trailer with the
  comparison table + a one-paragraph recommendation. Pick **one**
  model as the Phase 18 default; explain why; explicitly state the
  precache budget delta the next wave's integration will spend.

**Tests / verify:**

- `node app/scripts/measure-llm-budget.mjs` runs the full multi-model
  loop to completion; exits 0; prints the comparison table.
- The numbers landed in BACKLOG match the script's most recent
  output.
- `npm run typecheck && npm run lint` green.
- No production-source change; no model in `app/public/`; no new
  npm dep.

**Out of scope:** integrating any model into `analyze()`; bundling
any model into the precache; CSP audit (a future wave once
integration ships); model-license review (also a future wave).

### Part C — branch coverage threshold bump 88 → 89

**Branch:** `wave18-coverage-threshold`

**Cap:** **1 file edit** (`app/vite.config.ts`) + **1 doc edit**
(`docs/TESTING.md`). **No new tests.** **Contingent on Part A's
actual coverage** — if the post-Part-A actual is < 89.5%, this part
SKIPS (do not bump the threshold without 0.5% headroom).

**Approach:**

Wave 17-A's `<AppHeader>` extraction lifted branches from 88.31% to
88.35%. Wave 18-A's derived-state hook + sub-component should lift
further. Part C bumps the floor from 88 to 89 if there's actual
headroom.

The contingency is the contract. If after A merges,
`npm run test:coverage` reports branches < 89.5%, Part C ships a
no-op note in the wave summary saying "couldn't bump; here are the
actuals" rather than bumping a floor without buffer. Don't
"squeeze" extra coverage from new tests in this part — that's a
coverage push (Wave 16-A's pattern), not a floor bump.

**Files:**

- `app/vite.config.ts` — `branches: 88` → `branches: 89`.
- `docs/TESTING.md` — update the threshold paragraph to reflect the
  new floor + the new actual.

**Tests / verify:**

- `npm run test:coverage` with the new floor passes (i.e. CI gate
  remains green).
- The actual is ≥ 89.5% (the buffer rule).
- No new tests, no new src code.

**Out of scope:** bumping statements / functions / lines floors (no
plan target this wave); pushing for branches ≥ 90 (Wave 19 candidate
once the App.tsx surface drops further); adding tests to
artificially boost numbers — that's a different wave's job.

## Merge order

A is the precondition for C (C reads A's actual coverage). B is
independent of both (different files). Suggested:

```
A, B  (parallel-safe; disjoint files; A's branches are the input to C)
   ↓
C    (lands last after measuring A's actual; SKIPS if < 89.5%)
```

If A and B run in parallel (subagents or just direct serial), C
sequences after A regardless of B's status.

## TDD recommendation

**Direct (single Opus author) for A** — judgment calls about which
sub-component to extract and what the derived-hook interface should
look like. A subagent without product context will guess.

**Direct dispatch (parallel subagent) for B** — narrow,
mechanically verifiable: extend the existing script, run it, paste
numbers. Subagent dispatch overhead OK here because the work fits
cleanly in a single brief.

**Direct (≤5 min) for C** — too small to dispatch. Read A's actual
coverage, edit two lines, ship.

## Done definition

- All three PRs merged (or Part C skipped with rationale, if A's
  branches < 89.5%).
- `app/src/App.tsx` ≤ 820 lines.
- `app/src/App/useDerivedAppState.ts` exists with passing tests.
- `app/scripts/measure-llm-budget.mjs` measures ≥ 2 candidate
  models in one run.
- BACKLOG Phase 18 "Model selection + bundle-size budget gate" row
  has a recommendation paragraph naming a default model + the
  precache budget the next wave's integration will spend.
- (If C lands) `app/vite.config.ts` branches floor at 89; actual at
  ≥ 89.5%.
- No new IDB store, no new audit `kind`, no new product surface, no
  new npm dep, no model in the production bundle.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | App.tsx ≤ 820; ≤ 2 new files (1 hook + ≤1 sub-component); 0 behavior changes; coverage NOT bumped here |
| B | ≤ 3 model measurements; 0 src edits; 1 BACKLOG row trailer; no new dep |
| C | 1 src edit + 1 doc edit; SKIPS if branches < 89.5% post-A |

If a cap is breached, ship what fits and roll the overflow to Wave
19 explicitly. Do not negotiate caps up from inside a part.
