# Wave 60 — Empty states + helper text + jargon plain-readings

**Status:** 📋 Planned (on-deck)
**Filed:** 2026-05-01 at session end
**Successor to:** Wave 59 (deferral closeout sweep — PRs #232/#233/#234)
**Source:** `docs/audits/clarify-inventory-2026-04-29.md` deferral; BACKLOG.md L679

## Why this wave

Wave 48 Slice 3's copy work (~10 panels of empty states, helper text, and jargon plain-readings) is the last unticked clarify-inventory deferral. Sized 1H/6M/8L — high count, low per-string ROI. It was deferred from Wave 48 specifically because copy decisions need a *voice anchor* before drafting; without one, we'd churn through PR rounds rewriting each other's first drafts.

This is a brainstorm-first wave, not a dispatch-first wave.

## Scope

### Panels in scope (~10)

- `AnnotationsPanel` — empty state + finding-not-selected hint
- `LibraryPanel` — empty state for no saved leases
- `JurisdictionPickerPanel` — helper text + plain-reading of jurisdictions
- `StandardSuitePanel` — helper text + per-rule plain-readings
- `HybridPrecisionPanel` — empty state + jargon (similarity, threshold)
- `ClauseSimilarityPanel` — empty state + jargon
- `RedlinePanel` — empty state + jargon
- `ShareReviewPanel` — helper text + recovery copy
- `SideLetterPanel` — empty state + helper text
- `CustomRuleBuilderPanel` — intro copy + preview labels

### Out of scope

- Layout / structural changes to any panel (those go through `/impeccable distill`, not a copy sweep)
- New components or primitive extractions
- Tone shift in error states (keep current `<StatusMessage>` patterns)
- Crypto-passphrase prompts (separate deferral, requires memory-zeroing pattern)
- Three "Uncaught (in promise)" upload errors (deferred from Wave 59 — needs repro session)

## Approach

### Phase 0 — Voice brainstorm (session 1, before any code)

Run `superpowers:brainstorming` skill against the panel list. Output: a one-page voice anchor doc at `docs/audits/copy-voice-2026-05-XX.md` covering:

1. **Tone** — confirm Stewart Brand "tool not product" voice from `PRODUCT.md` / `DESIGN.md`. Sample sentences for each panel category (empty state, helper text, jargon explainer).
2. **Vocabulary table** — for each jargon term (similarity, threshold, redline, side letter, jurisdiction, etc.), the canonical plain-reading. Lock these so cross-panel consistency emerges naturally.
3. **Anti-references** — a short list of phrasings to avoid (e.g. "Get started by…", "Welcome to…", marketing-speak).
4. **Format conventions** — sentence case vs title case, period at end of helper text, em-dash vs colon, etc.

Brainstorm should converge in one session. If it doesn't, the wave is wrong and we re-scope.

### Phase 1 — Per-panel copy draft (session 1 cont. or session 2)

In the same plan doc (or a sibling), draft the actual strings per panel. Surface in a single review pass before any code. This is reviewable text in markdown, not a PR — fast iteration.

### Phase 2 — Implementation slices (sessions 2–3)

Once copy is locked, dispatch in 3 file-disjoint slices:

- **Slice 1** — Annotations + Library + Jurisdiction (3 panels, mostly empty states)
- **Slice 2** — StandardSuite + HybridPrecision + ClauseSimilarity (3 panels, jargon-heavy)
- **Slice 3** — Redline + ShareReview + SideLetter + CustomRuleBuilder (4 panels, mixed)

Each slice is one PR. Tests pin each new string by exact match (regression guard against drift). Auto-merge per project default — none of these touch `app/src/{security,audit,storage}/` so no rebase-and-merge required.

## Preflight when resuming

1. Verify #232, #233, #234 all merged. If any still open, finish Wave 59 first.
2. `git fetch origin && git pull --ff-only main`.
3. Confirm post-merge `ci` workflow on main is green (Wave 49 semantic-conflict gate).
4. Prune `worktrees/wave59-slice*` directories (`git worktree remove`).
5. Open `superpowers:brainstorming` skill — do NOT skip Phase 0. The whole point of this wave is to fix voice before code.

## Success criteria

- [ ] Voice anchor doc shipped (`docs/audits/copy-voice-2026-05-XX.md`)
- [ ] Per-panel copy locked in plan doc before any implementation PR opens
- [ ] 3 implementation PRs, each with regression tests pinning strings
- [ ] BACKLOG row L679 ("Wave 48 Slice 3 — empty states + helper text + jargon plain-readings") promoted to `[x]` with PR refs
- [ ] No layout / structural / new-component changes leaked into the wave (scope discipline)

## Risk + mitigations

| Risk | Mitigation |
|------|------------|
| Copy churn across PRs (different voice per slice) | Phase 0 voice anchor + vocabulary table; reviewers cross-check against the doc, not the PR diff |
| Jargon explainers leak design opinions ("Similarity is how confident…") | Stick to factual plain-readings; if a term needs hedging, defer to a follow-up wave on UX micro-copy patterns |
| 10 panels feels small but compounds | Strict slice boundaries; resist bundling other "while we're at it" cleanup |
| Copy work surfaces a real IA gap (e.g. "this panel doesn't have an empty state because nobody designed one") | Halt and file a separate distill-pass row; don't paper over with copy |

## Closeout checklist (fill at end of wave)

- [ ] All 3 implementation PRs merged
- [ ] Post-merge `ci` workflow green on main after each merge
- [ ] BACKLOG L679 ticked with PR numbers
- [ ] This plan doc flipped to "✅ Shipped (PRs #..., #..., #...)"
- [ ] Voice anchor doc cross-linked from `docs/CLAUDE.md` if it generalizes (decide at the time)
