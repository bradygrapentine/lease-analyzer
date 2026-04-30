# Wave 52 — Design polish sweep

**Goal.** Calibrate the surfaces Wave 51 just landed. Wave 51 was IA
(net-new components, shifted defaults). This wave is *finish work* —
the rhythm-spacing-typography-color pass that turns "shipped" into
"resolved". One `/refine` 8-pass loop per target.

**Constraint.** `/refine` is sequential per target (8 passes is a
calibration ladder; reordering breaks the skill). One Claude session
cannot truly parallelize across targets. So "parallelization" in this
plan = file-touch boundaries that let PRs merge in any order, not
concurrent execution.

## §1 Hard rules

1. **One target per PR.** Six PRs on `wave52-refine-<target>` branches.
2. **No new tokens.** Polish reaches into `index.css` only to *use*
   existing OKLCH tokens — not to add new ones. If a pass wants a new
   token, file a follow-up; don't bolt it on.
3. **Aria inventory survives.** Same rule as Wave 51 §1.5. Refining
   visuals must not move a `data-testid` or rename a `role`/`aria-*`.
4. **Local gate green** (`typecheck && lint && test`) before push.
5. **No coverage-floor moves.** Polish doesn't add or remove tests;
   coverage is incidental. If a `/refine` pass touches a tested
   element label, *update the test*, don't relax the floor.
6. **No Codex gate.** Pure visual work; no security-adjacent paths.
7. **Browser walk before push.** `/refine` can't see the rendered
   output — open the dev server, navigate to the target, eyeball it.
8. **No multi-pass regressions.** If pass 5 (`quieter`) has to undo
   pass 4 (`bolder`), stop the loop and report — that's a sign the
   target was already calibrated.

## §2 Target ranking

Six targets ordered by impact × refinability. Tier 1 ships first to
establish the design language; Tier 2 PRs can land in any order
afterward without coupling.

### Tier 1 — set the bar (sequential, both before any Tier 2 ships)

1. **`MarginaliaReader.tsx`** — the new default reading surface; the
   one users stare at longest. Highest-leverage refinement target.
2. **`FindingsPanel.tsx`** — the dense affordance cluster. Wave 51-E
   added a headline + chips but the section still has more weight
   than rhythm. Refine establishes the chip / heading / row balance
   that Tier 2 mirrors.

### Tier 2 — independent (any order, parallel-mergeable)

3. **`FindingDetailModal.tsx`** — modal already coherent; pass should
   converge fast (likely stops at pass 3–4).
4. **`UploadView.tsx`** — landing page. First impression. Bigger
   typographic moves possible.
5. **`PortfolioPanel.tsx`** — got a totals strip in 51-F but the
   matrix table is utilitarian. `bolder` + `quieter` are the levers.
6. **`AppRedlinePane.tsx` + `RedlinePanel.tsx`** — header strip in
   51-F was minimal; rhythm + diff visual hierarchy needs work.

## §3 Per-target ledger

Each target gets:
- **Branch:** `wave52-refine-<slug>`
- **Files touched:** the component + its CSS hooks; story / test
  updates only if a label moves.
- **Passes expected to fire:** 4–7 of 8 (delight + overdrive often
  early-stop in this codebase's restrained register).
- **Browser walk:** specific route to verify.

| # | Target | Files | Browser walk |
|---|--------|-------|--------------|
| 1 | MarginaliaReader | `MarginaliaReader.tsx` (+ `.stories.tsx`) | Current tab, sample lease |
| 2 | FindingsPanel | `FindingsPanel.tsx` | Current tab right rail |
| 3 | FindingDetailModal | `FindingDetailModal.tsx` | click any finding |
| 4 | UploadView | `UploadView.tsx` | cold load |
| 5 | PortfolioPanel | `PortfolioPanel.tsx` | Portfolio tab |
| 6 | AppRedlinePane + RedlinePanel | both files | Redline tab |

## §4 Closeout

- [ ] All six PRs merged.
- [ ] Lighthouse a11y still ≥ 0.95.
- [ ] axe story sweep still 0 serious/critical.
- [ ] No new tokens added to `index.css`.
- [ ] DESIGN.md updated only if a *named* component visual changed in
      a way the prose would mislead a future agent. Don't refresh for
      cosmetics.
