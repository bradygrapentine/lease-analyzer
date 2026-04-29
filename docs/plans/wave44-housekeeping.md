# Wave 44 — Housekeeping (docs reconcile + strictness slice + branch-coverage push + backlog/roadmap refresh) Implementation Plan

**Goal.** Pay down accumulated paper-cuts in one PR: stale doc footprint numbers, surplus type-strictness escapes, branch-coverage on the laggard files, and a roadmap/backlog refresh that reflects what actually shipped through Wave 43.

**Architecture.** Mechanical, low-risk, single-track. No new features, no dep bumps (none available — see §2). Each item is independently revertable.

**Tech Stack.** TS, vitest, eslint. Docs are markdown.

**Base SHA.** `origin/main` (`bd7ee40`) at start of session.

---

## §1 Hard rules

1. **One PR.** Commit per item is fine; don't open four PRs.
2. **No new dependencies.** No new runtime modules.
3. **No UI behavior changes.** Strictness fixes must be type-only or test-only refactors. If a removal would change runtime behavior, defer it.
4. **Touch ≤ 25 files total** (excludes lockfile). Hard cap. Strictness sweep is the file-count risk — if it would blow the cap, ship a smaller slice.
5. **Each item commits + verifies independently** (`typecheck && lint && test`) before moving to the next.

## §2 Out of scope

- **Major dep bumps.** `npm outdated` shows only majors (React 18→19, Vite 5→8, vitest 1→4, Storybook 8→10, eslint 8→10, TS 5→6, pdfjs 4→5, transformers patch). All are intentional holds — each warrants its own dedicated wave with a migration plan. Wave 44 ships zero dep changes.
- **Phase 18 hybrid work.** Held per Wave 40 decision; re-evaluation triggers are documented.
- **New rules / matchers / panels.**
- **Coverage threshold ratchet.** Wave 43 just bumped to 96/90/93/96. Wave 44 raises *actuals*, not floors.

## §3 Execution

Direct, single-track, ~2-3 hours. No subagents.

## §4 Item A — Doc footprint reconcile

**Why.** `docs/BACKLOG.md` "Current footprint" section is stale enough to mislead. Concrete drift measured 2026-04-28:

| Field          | BACKLOG says | Actual                        |
|----------------|--------------|-------------------------------|
| Source files   | ~182         | **168** (`*.ts`/`*.tsx` excl. `.test.`/`.stories.`) |
| Test files     | ~153         | **179**                       |
| Test count     | ~1217        | **~1367 vitest cases** (grep `^\s*(test\|it)\(`) |
| App.tsx LOC    | 541          | **571**                       |
| Coverage floors | 95 / 89 / 91 / 95 | **96 / 90 / 93 / 96** (post Wave 43) |

**Files:**
- Modify: `docs/BACKLOG.md` lines 19-29 ("Current footprint" table).

**Steps:**
- [ ] Re-measure each cell (`find app/src -name '*.ts' -o -name '*.tsx' | grep -v '.test.\|.stories.' | wc -l`, `find app/src -name '*.test.ts' -o -name '*.test.tsx' | wc -l`, `grep -rcE "^\s*(test\|it)\(" app/src --include='*.test.*' | awk -F: '{s+=$2} END {print s}'`, `wc -l app/src/App.tsx`, read coverage floors from `app/vite.config.ts`).
- [ ] Update the table cells in place; preserve the row ordering and the gate-command column.
- [ ] Verify `docs/CLAUDE.md` line 27 (`Coverage floors move with the test-hardening work — see docs/TESTING.md`) — this already redirects to TESTING.md, so no edit needed there.
- [ ] `git diff docs/BACKLOG.md` — confirm only the footprint table changed.
- [ ] Commit: `chore(docs): reconcile BACKLOG footprint with actuals (post-Wave-43)`.

## §5 Item B — Roadmap refresh + Phase 18 status

**Why.** `docs/ROADMAP.md` (lines 235-275) describes Phase 19 as "proposed; Wave 27+" and lists Wave 27 candidates as if pending. Reality: most have shipped (worker-path classifier work happened across multiple waves; click-to-explain → audit linkage shipped in Wave 32-C; nightly real-model GHA shipped in Wave 32-A; transformers v4 migration shipped in Wave 36-B/C; Wave 40 *held* Phase 18 productionization with a re-evaluation trigger; Wave 41 closed WCAG 2.1 AA).

**Files:**
- Modify: `docs/ROADMAP.md` (Phase 18 / Phase 19 sections, lines ~191-275).

**Steps:**
- [ ] Read the current Phase 18 + Phase 19 sections.
- [ ] For each Wave-27-candidate bullet in the closing paragraph (lines 244-264), check git log for the matching wave (`git log --oneline | grep -i 'nightly real-model\|click-to-explain\|worker-path\|branches.*90\|transformers'`). Mark each as "shipped (Wave NN)" or "still open" inline.
- [ ] Add a new short subsection: `### Phase 18 status (post-Wave-40)` summarizing the hold + re-evaluation trigger from `docs/plans/wave40-phase18-revisit-or-retire.md`.
- [ ] Add a short `### Phase 19 status` block: WCAG 2.1 AA closed (Wave 41), coverage floors at 96/90/93/96 (Wave 43), nightly real-model job live (Wave 32-A), Tauri retired (Wave 42), bundle re-audited (Wave 38).
- [ ] Verify references back to BACKLOG line numbers still work (or remove the line-number references — line numbers are fragile across edits).
- [ ] Commit: `docs(roadmap): mark shipped Wave 27 candidates; add Phase 18/19 status`.

## §6 Item C — Type-strictness slice

**Why.** Snapshot 2026-04-28: 99 occurrences of `: any` / `as any` / `as unknown as` and 61 `eslint-disable`/`@ts-expect-error`/`@ts-ignore` lines in `app/src`. Death by a thousand cuts — pay down the cheapest 10-15.

**Strategy.** Read-only first. Spend ≤30 min finding the easiest wins (a deprecated cast that the upstream type now expresses correctly; a `disable` for a rule that no longer fires; a stale `@ts-expect-error` whose underlying issue was fixed). Stop at 10 fixes.

**Files:**
- Modify: up to 10 `.ts`/`.tsx` files in `app/src/**` (NOT `app/src/ui/**` if it would blow the file cap).

**Steps:**
- [ ] Inventory: `grep -rnE '@ts-expect-error\|@ts-ignore' app/src --include='*.ts' --include='*.tsx' | tee /tmp/expect-errors.txt`. Count: 61.
- [ ] For each `@ts-expect-error`, comment it out, run `npm run typecheck` — if no error appears, the suppression is dead. Delete it. Cap: 10 deletions per session.
- [ ] Run the same drill for `eslint-disable-next-line` comments where the rule name is suspect (`@typescript-eslint/no-explicit-any` on a line that no longer has `any`).
- [ ] For `: any` / `as any` casts: pick 3-5 in non-UI modules where the upstream type is now precise (e.g. pdf.js types improved in 4.x; idb has tighter generics). Replace with the real type. If it doesn't compile in 3 min, revert and skip.
- [ ] After each batch of ≤5 fixes: `npm run typecheck && npm run lint && npm test`. Green required before next batch.
- [ ] Commit: `refactor(types): remove N stale ts-expect-error/eslint-disable suppressions`.

## §7 Item D — Branch-coverage push (laggard files)

**Why.** Coverage actuals 2026-04-28: **97.61 / 90.47 / 94.4 / 97.61**. Branches at 90.47 vs 90 floor = 0.47 headroom — a single new uncovered branch trips CI. Functions at 94.4 vs 93 floor = 1.4. Stmt/Lines at 97.61 vs 96 = healthy. **Target: branches +1.5 to ≥92.0** so the floor has real headroom for the next wave's edits.

**Hot files** (from §6 coverage report — branch %):

| File | Stmts | Branches |
|------|-------|----------|
| `src/worker/handleRequest.ts` | 100 | 71.42 |
| `src/worker/workerClient.ts` | 100 | 84.21 |
| `src/ui/system/Field.tsx` | 96.2 | 90.9 |
| `src/storage/useColorScheme.ts` | 94.8 | 84.84 |
| `src/versioning/deltaPacket.ts` | 94.97 | 87.5 |
| `src/workflow/buildIcs.ts` | 93.82 | 94.59 |
| `src/workflow/copySummary.ts` | 98.09 | 85.71 |
| `src/hooks/useInViewport.ts` | 100 | 88.88 |

**Files:**
- Modify (test only): up to 6 of `src/worker/handleRequest.test.ts`, `src/worker/workerClient.test.ts`, `src/storage/useColorScheme.test.ts`, `src/versioning/deltaPacket.test.ts`, `src/workflow/copySummary.test.ts`, `src/hooks/useInViewport.test.ts`. Create the test file if it doesn't exist (most do; check first).

**Steps:**
- [ ] Re-run `npm run test:coverage` and capture per-file uncovered line numbers (already in the report — column 5).
- [ ] For each target file, open the source, look at the uncovered line numbers, identify the branch (usually a guard clause, error path, or a `??`/`||` fallback). Write the smallest test that exercises it.
- [ ] After each test addition: `npm run test:coverage` and confirm the file's branches % moved up. If a test doesn't move the needle, the branch is unreachable in practice — file an issue comment in the source (`// branch unreachable: <reason>`) and stop.
- [ ] Stop when global branches ≥ 92.0% OR after 6 files touched, whichever comes first.
- [ ] **Do NOT raise the floors in `vite.config.ts`** in this wave. Leave headroom for Wave 45+. (Floor ratchet is a separate, deliberate decision.)
- [ ] Commit: `test: lift branch coverage to N.NN% (laggard files)`.

## §8 Item E — Backlog/Roadmap reconciliation

**Why.** Per request: "Add to backlog based on roadmap, and enhance roadmap if nothing to add to backlog." After §4-§7, the docs reflect ground truth. Now check whether the roadmap implies stories not yet in the backlog.

**Files:**
- Modify: `docs/BACKLOG.md` (add rows to "Cross-cutting tech debt" or relevant Phase section); optionally `docs/ROADMAP.md` (add a forward-looking bullet).

**Steps:**
- [ ] Read `docs/ROADMAP.md` Phase 14 ("Content depth") and any other Phases marked "optional" or "future". For each commitment that has no matching `[ ]` row in BACKLOG, add a one-line entry to BACKLOG with a `wave-44-survey` tag in the description so future sweeps can find it.
- [ ] If every roadmap commitment already has a backlog row: enhance the roadmap with one of:
  - A "Phase 20 — Long-tail polish" bullet list seeded from the type-strictness inventory (§6 leftover suppressions, lazy-load eligibility for the remaining always-loaded panels, the 10 known stale doc references).
  - A "Phase 18 re-evaluation criteria" subsection making the Wave 40 trigger more concrete (specific feedback rate / latency / cost thresholds).
- [ ] Hard cap: **5 new BACKLOG rows max**. Anything bigger needs a brainstorm session, not a housekeeping wave.
- [ ] Commit: `docs(backlog): add N follow-ups surfaced by Wave 44 reconcile` (or `docs(roadmap): seed Phase 20 long-tail polish`).

## §9 Verification (final, before push)

- [ ] `cd app && npm run typecheck` — green.
- [ ] `cd app && npm run lint` — 0 warnings.
- [ ] `cd app && npm test` — full suite green.
- [ ] `cd app && npm run test:coverage` — branches actual ≥ 92.0% AND ≥ 90.0% floor.
- [ ] `cd app && npm run build` — succeeds.
- [ ] `cd app && npm run check:budget` — green.
- [ ] `git diff --stat` — total ≤ 25 files (excluding lockfile).
- [ ] No `app/src/ui/**` runtime changes (only test files there are OK).

## §10 PR

- Title: `wave44: housekeeping (docs reconcile + strictness slice + branch coverage + backlog refresh)`
- Body sections:
  - **A — Doc footprint reconcile.** Before/after table.
  - **B — Roadmap refresh.** List of Wave 27 candidates marked shipped + new Phase 18/19 status blocks.
  - **C — Type strictness.** Count of suppressions removed; list files touched.
  - **D — Branch coverage.** Before/after global %; per-file lifts.
  - **E — Backlog reconcile.** New rows added (or roadmap enhancement chosen).
- **Deferred** section:
  - Major dep bumps (React 19, Vite 8, vitest 4, Storybook 10, eslint 10, TS 6, pdfjs 5) — each warrants its own wave plan.
  - Remaining `: any` / `as any` (89 of original 99) — incremental, no urgency.
  - Coverage floor ratchet — wait one more wave to confirm the new actuals stick.

## §11 Risk register

| Risk | Mitigation |
|------|------------|
| Strictness fix removes a `@ts-expect-error` that's actually load-bearing in a code path the typechecker can't see (dynamic import, runtime cast). | Drill: comment out → typecheck → only delete if zero new errors. Run full test suite, not just typecheck, after each batch. |
| New branch tests assert behavior that's actually a bug, locking it in. | Read the source path before writing the test. If the branch looks like a bug, file it as a backlog item under §8 instead of testing it. |
| Doc reconcile churn obscures real change in PR review. | Separate commits per item. Reviewer can read commit-by-commit. |
| Phase 18 status reword accidentally implies a decision that wasn't made. | Lift wording verbatim from `docs/plans/wave40-phase18-revisit-or-retire.md` decision section. |
| Branch coverage push reveals the laggard branch IS unreachable. | Document with `// branch unreachable: <reason>` comment in source and move on; don't game coverage with bogus tests. |

## §12 Self-review checklist (writing-plans skill §Self-Review)

- [x] **Spec coverage.** User asked for: (a) all 9 candidate items from brainstorm — Items 1 (deps), 3 (doc rot), 8 (strictness) folded in; Items 2/4/5/6/9 deferred to §10 with reasons (deps no minor available; tests/storybook/CI/bundle out of housekeeping scope or already covered by Wave 38/41/43). (b) Tests to 90/95% coverage — §7 targets 92% branches with explicit floor (already 97/90/94/97). (c) Sync docs/roadmap — §4 + §5. (d) Add to backlog from roadmap — §8.
- [x] **Placeholder scan.** No "TBD"/"implement later" — every step has concrete commands or file lists.
- [x] **Type consistency.** No invented types/symbols. All file paths verified to exist (or marked "create if doesn't exist").
