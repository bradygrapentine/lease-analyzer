# Wave 40 — Phase 18 hybrid: revisit or retire Implementation Plan

> **Pairing:** Runs in parallel with **Wave 41 (WCAG AA audit)** — disjoint file ownership (W40 owns `app/src/llm/**`, hybrid evidence flow, classifier asset pipeline, related docs; W41 owns `app/src/ui/**` and a11y-only edits).

**Goal:** Decide the future of Phase 18 (hybrid LLM-assisted findings).
Wave 35 was a NO-OP gate; Wave 36 migrated transformers v2→v4; the
feature has been *quiet*. Either invest in a concrete next step or
formally retire the code path. Output: a decision doc + the
corresponding action (small).

**Architecture.** Investigation-first, narrowly-scoped action second.
The hybrid path lives in `app/src/llm/**` (loadClassifier, etc.),
fans out into `Finding.evidence` (the `modelId` + `similarity` shape
documented in `docs/CLAUDE.md`), and surfaces in `FindingsPanel` via
the `finding-llm-badge` button. Audit wires `llm-classify` and
`hybrid-feedback` events.

**Tech Stack.** `@huggingface/transformers` v4 (post-Wave-36),
on-device ONNX, IndexedDB audit log.

**Base SHA.** `origin/main` at start of session. Read-only until §5.

## §1 Hard rules

1. **Read the prior waves before deciding.** Wave 35 plan/PR (#147,
   #148), Wave 22-A, Wave 24-B/25-B (badge), Wave 29-C (feedback),
   Wave 30 (precision), Wave 36 (transformers migration). The decision
   needs to cite what was tried and what bounced.
2. **No new ML models in this wave.** The decision is invest-or-retire
   on what exists, not "swap in a different model." A model swap is
   its own wave.
3. **One PR.** Decision doc + the small action ship together.
4. **No UI files.** Wave 41 owns `app/src/ui/**` in the parallel
   session; this wave's action lives in `llm/`, `audit/`, or docs.
5. **If retiring:** delete code, don't `if (false)`. Half-deletions
   rot.

## §2 Out of scope

- Model swap (e.g. trying a different ONNX classifier).
- New evidence shapes / new audit kinds.
- Re-running benchmarks beyond what's already in `app/scripts/`
  hybrid-stats output.

## §3 Execution

Direct, single-track. Estimated 2-4 hours (most of it is reading +
deciding, not coding).

## §4 Investigation steps

- [ ] **Read** the Wave 35 hybrid-stats report (linked from PR #148)
  and the gate decision rationale.
- [ ] **Re-run** `app/scripts/audit-prod.mjs` (or whichever script
  emits the hybrid-stats summary) to capture *current* numbers, not
  Wave 35's snapshot. Record: hybrid-finding count, `not-relevant`
  feedback rate, similarity histogram.
- [ ] **Audit usage.** `grep -rn 'evidence.modelId\|llm-classify\|hybrid-feedback' app/` —
  count call sites. If feedback events are near-zero across many
  sessions, that's signal toward retire.
- [ ] **Cost ledger.** What's the bundle cost of keeping the v4
  pipeline + classifier assets (`public/classifier/*`)? Cite a number
  from `npm run check:budget`.
- [ ] **Decide.** One of:
  - (A) **Invest** — name *one* concrete next step (e.g. raise
    similarity threshold from X to Y, gate badge on N feedback events,
    expand to one new rule category). Must be ≤ 3 file edits.
  - (B) **Retire** — delete `app/src/llm/**`, the badge UI hook
    (coordinate with W41 if running parallel — easier path: leave UI
    intact this wave, retire the *load* and let UI no-op when
    `evidence` is absent; UI cleanup is a follow-up).
  - (C) **Hold** — explicitly defer with a re-evaluation trigger
    (e.g. "revisit after Wave 45 if feedback rate ≥ X"). Acceptable but
    must be specific, not vague.

## §5 File changes

If (A) Invest: ≤ 3 files, must include the threshold/feature constant
plus a test. Update `docs/RULES.md` or hybrid-related doc.

If (B) Retire (load-only path):
- Remove `app/src/llm/loadClassifier.ts` and tests.
- Remove the classifier asset build from `app/scripts/build-classifier-assets.mjs`
  and from `app/vite.config.ts` if it has a wire-up.
- Remove `public/classifier/**` from the served tree.
- Drop the v4 dep from `app/package.json`. Run `npm install`.
- Leave `Finding.evidence` shape intact (other code may still produce
  it from non-LLM sources later) but document the change in
  `docs/CLAUDE.md` "Adding a panel" → hybrid-finding badge note.

If (C) Hold: zero code changes. Decision doc only.

Touch ≤ 8 files (retire path is the largest).

## §6 Verification

- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] `npm run build` succeeds.
- [ ] If retired: `grep -rn 'loadClassifier\|@huggingface/transformers' app/` returns nothing
  (or only the docs noting retirement).
- [ ] `npm run check:budget` — if retired, expected drop in app shell
  size; record the delta.
- [ ] If invested: the new threshold / behavior is covered by at least
  one test.

## §7 PR

- Title: `wave40: phase 18 hybrid — <invest|retire|hold>`
- Body sections:
  - **Decision.** One sentence + the path picked.
  - **Evidence.** Current hybrid-stats numbers, feedback rate, bundle cost.
  - **Action shipped.** The diff.
  - **Re-evaluation trigger** (if hold).

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| Retire path leaves orphaned UI code (badge with no producer). | Leave UI intact; let badge no-op gracefully when `evidence` absent. UI cleanup is a follow-up wave so we don't conflict with W41. |
| Decision is "hold" without a trigger → indefinite drift. | Hard rule §4(C): trigger must be specific, not vague. |
| Retiring removes data shape some audit log row depends on. | `Finding.evidence` shape stays; only the *producer* (LLM load) goes away. Audit rows already written stay valid. |
| Bundle drop number is misleading because v4 was lazy. | Cite both `dist/` total and "loaded on first paint" subtotal. |
