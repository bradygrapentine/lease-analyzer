# Wave 41 — WCAG 2.1 AA audit Implementation Plan

> **Pairing:** Runs in parallel with **Wave 40 (Phase 18 hybrid revisit/retire)** — disjoint file ownership (W41 owns `app/src/ui/**`, Storybook stories, a11y-only edits; W40 owns `app/src/llm/**` + classifier asset pipeline).

**Goal:** Complete the WCAG 2.1 AA pass that's been deferred per
`docs/CLAUDE.md` ("Deferred / explicitly out of scope"). Wave 28-F did
fix-as-found on accordion + severity table; this wave does a
*systematic* audit with axe-core across every panel + page state and
ships fixes for everything in violation.

**Architecture.** Audit-first, fix second. Use axe-core (already a
devDep per W28-F) to scan each panel in jsdom + Storybook, plus
keyboard-only navigation walks via Playwright. The `chrome-devtools-mcp:a11y-debugging`
skill is available — use it for the manual portion.

**Tech Stack.** axe-core, @axe-core/react, Storybook 8, Playwright, RTL.

**Base SHA.** `origin/main` at start of session. Read-only until §5.

## §1 Hard rules

1. **No logic changes.** A11y fixes only — semantics, ARIA, focus
   management, contrast, tap targets. If a finding requires
   restructuring component logic, defer it (note in PR body).
2. **No `app/src/llm/**` edits.** Wave 40 owns that dir in the parallel
   session.
3. **One PR.** Audit report + fixes ship together. Audit report is the
   PR body's main section.
4. **Fix everything Critical / Serious.** Moderate / Minor: ship if
   the fix is one-line; otherwise defer with rationale.
5. **No Storybook story deletions.** Adding a11y addons / decorators OK.

## §2 Out of scope

- Color-token redesign (own wave; touches design system).
- New panels / new component types.
- Translating ARIA labels to other languages (i18n is its own concern).
- Replacing the test runner / Storybook version.

## §3 Execution

Direct, single-track. Estimated 3-6 hours (audit is the long tail).

## §4 Audit steps

- [ ] **Inventory panels.** `find app/src/ui -name '*.tsx' -not -name '*.test.tsx' -not -name '*.stories.tsx' | sort` — list every component and tag which are user-facing.
- [ ] **axe-core in tests.** For each panel without an existing axe scan
  (most have one only if W28-F added it), add an `axe(container)` call
  to its `*.test.tsx`. Use `vitest-axe` or `@axe-core/react`.
- [ ] **axe in Storybook.** Confirm the a11y addon is enabled in
  `app/.storybook/main.ts` (it is per W28-F). Run `npm run storybook`
  and walk the panel set, recording violations per story.
- [ ] **Keyboard walk.** Manual `npm run dev` walk: Tab through the entire
  app, including upload → analyze → findings → redline → audit log → settings.
  Record any focus traps, missing focus rings, or skipped controls.
- [ ] **Contrast scan.** Use the Chrome DevTools issues panel (or
  `chrome-devtools-mcp:a11y-debugging` skill) on dark mode + light mode
  for each panel. Record any tokens that fail 4.5:1 (text) or 3:1 (UI).
- [ ] **Catalogue findings.** One row per violation: `{component,
  severity (Critical/Serious/Moderate/Minor), rule (axe-core id), fix}`.

## §5 File changes

Driven by the catalogue. Each fix is small and component-local.
Likely shapes:

- Add `aria-label` / `aria-labelledby` / `aria-describedby` where missing.
- Replace `<div onClick>` with `<button>` (or add `role="button"`,
  `tabIndex={0}`, key handler — but prefer `<button>`).
- Add `<label htmlFor>` where form controls are unlabeled.
- Add visible focus styles (`:focus-visible` token) to any control
  missing them.
- Adjust a token's value if contrast fails (touches the design-token
  CSS file — make this the *one* exception to "no design changes,"
  and only if axe flagged it as Serious+).
- Add a `:focus-visible` outline class somewhere in the global CSS.

Each fix gets a test: either an axe assertion in the existing
`*.test.tsx`, or an RTL assertion that the new ARIA / role / label is
present.

Touch ≤ 25 files (one fix per finding, fixes typically touch
component + test).

## §6 Verification

- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] `npm run storybook` (manual walk) — a11y addon shows 0 Critical /
  Serious across the panel set.
- [ ] `npm run lhci` — accessibility score still ≥ 95 (existing gate).
  If the score *rose*, mention it in PR body but don't tighten the
  threshold here (separate wave).
- [ ] Manual keyboard walk: Tab + Enter + Esc handle every interactive
  element correctly.

## §7 PR

- Title: `wave41: WCAG 2.1 AA audit (+ <n> fixes)`
- Body sections:
  - **Audit method.** axe in tests, axe in Storybook, manual keyboard
    + contrast walk.
  - **Findings table.** All Critical / Serious / Moderate / Minor with
    fix status (Shipped / Deferred + reason).
  - **Coverage.** What % of UI files now have an axe assertion in their
    test (number that moved).
  - **Lighthouse delta.** Before / after a11y score.
  - **Update `docs/CLAUDE.md`** "Deferred / explicitly out of scope" —
    remove the WCAG AA audit line, replace with "WCAG 2.1 AA audit
    completed in Wave 41 (PR #<n>); see `docs/wave41-a11y-audit.md` for
    findings table."

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| axe-core flags a Serious violation that needs component restructuring (logic change). | Hard rule §1.1: defer with explicit "deferred to follow-up wave" note. Do NOT silently restructure. |
| Adding axe to every test file slows the suite materially. | Time the suite before / after; if >20% slowdown, gate axe behind a `RUN_AXE=1` env flag and run it in CI only. |
| Contrast token fix breaks Storybook visual regressions. | Confirm in Storybook before commit; if a story changes appearance, update its snapshot intentionally. |
| Conflict with Wave 40 if the parallel session inadvertently edits a UI file (e.g. badge component). | Hard rule §1.2 + run `git diff --name-only origin/main..HEAD` before commit; any `app/src/llm/**` touch = abort. |
