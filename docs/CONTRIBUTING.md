# Contributing

This is a single-maintainer project right now; the workflow here keeps
that working as the codebase grows. Read [`docs/SETUP.md`](./SETUP.md)
before your first contribution.

## Branch naming

| Prefix                      | When to use                                         |
| --------------------------- | --------------------------------------------------- |
| `wave{N}-{slug}`            | Work tied to a numbered wave plan in `docs/plans/`. |
| `wave{N}-{X}`               | A specific part of a multi-part wave (`wave14-A`).  |
| `fix/{slug}`                | Bug fix outside any wave.                           |
| `docs/{slug}`               | Doc-only changes that don't fit a wave.             |
| `tdd-wave/{N}/specs-{slug}` | TDD spec branches (red phase only).                 |

Short slugs are encouraged — the commit message + PR title carry the
detail.

## Local gate (before pushing)

Run the same sequence CI runs:

```bash
cd app
npm run typecheck && npm run lint && npm run test:coverage
npm run check:budget   # only if your change touches build-affecting files
```

For UI changes, also `npm run dev` and walk the affected flow in a
browser. jsdom doesn't cover canvas, real Web Workers, file-input
semantics, or `IntersectionObserver` — those need a real browser.

The repo-root `husky` pre-commit hook runs `eslint --fix` and
`prettier --write` on staged `app/**` files. The hook is a fast
feedback loop, not a substitute for the full gate.

## Pull requests

1. Push your branch.
2. Open a PR with a body that includes a `## Summary` (1-3 bullets) and
   a `## Test plan` (markdown checklist of what you ran).
3. After CI passes (verify + smoke), arm `gh pr merge --auto --squash`
   exactly once. Don't retry if it doesn't stick — surface the blocker
   and ask.
4. The repo has `delete_branch_on_merge: true`; merged branches clean
   themselves up.

## What not to land

- **No binary fixtures.** Synthesize PDFs in tests via `pdf-lib` (see
  `app/src/parser/testFixtures.ts` for the shared helper).
- **No CDN-hosted assets.** The CSP is `default-src 'self'`. If a dep
  wants a remote worker / font / image, bundle it locally.
- **No new `audit kind` strings without a doc edit.** When you add a
  new audit event, also document it in `docs/CLAUDE.md` § "Adding a
  panel" / "Audit events" so future contributors don't reinvent it.
- **No new IDB stores without a schema bump + migration test.** The
  `_reset<Db>ForTests` pattern + `if (oldVersion < N)` migration gates
  in `app/src/storage/storage.ts` are the templates.
- **No `--no-verify` commits.** If the pre-commit hook is wrong, fix
  the hook; don't bypass it.
- **No bundled secrets.** The local-first contract means there's
  nothing legitimate to hardcode at the app level.

## Doc edits

- `docs/BACKLOG.md` — single source of truth for ticket status. Flip
  `[ ]` → `[x]` when work merges; rows mention the wave / branch / PR.
- `docs/CLAUDE.md` — coding conventions; edit when conventions change,
  not as a scratchpad.
- `docs/ROADMAP.md` — phased plan. New phases get one-paragraph
  framing + 3-5 candidate features; nothing committed.
- `docs/SYSTEM_DESIGN.md` — the architecture map; update when you bump
  an IDB version, add an audit `kind`, or change a data-shape contract.
- `docs/SECURITY.md` — security posture. Update the "Last review" date
  whenever you do a security pass (Wave 16-F, future audits, etc.).

Wave plans live under `docs/plans/wave{N}-{slug}.md`. Land the plan as
its own PR before executing the wave (mirrors how PR #50 / #61 landed
the wave 14-15-16 plans ahead of code).

## Coding conventions in 60 seconds

Full version: [`docs/CLAUDE.md`](./CLAUDE.md). The high-leverage rules:

- **Pure modules first, React last.** Parser / rules / compare /
  storage / redline / versioning / signing are pure-ish functions; UI
  consumes their outputs.
- **No barrel logic.** `index.ts` files are re-exports only and are
  excluded from coverage.
- **Strict TS.** `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`. Use `app/src/test/assert.ts` (`at`, `defined`)
  in tests instead of scattered `!`.
- **Comments explain WHY, not WHAT.** A comment that just describes
  the code below is noise; a comment that captures a hidden invariant
  or a past bug is signal.
- **CSP is a hard constraint.** No new network egress, no new
  third-party origins, ever. Test with `npm run check:csp`.

## When you're stuck

- Search past PRs (`gh pr list --search "<keyword>"`); the repo's
  history is heavily annotated with rationale.
- Check `docs/CLAUDE.md` § "Data handling gotchas" — most "why doesn't
  this work in tests" answers live there.
- Open a draft PR with the failing state and a question; the wave
  plans usually have an "Out of scope" section that names the trap.
