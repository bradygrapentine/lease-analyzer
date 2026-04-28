# Wave 42 — Tauri matrix decision: **Retire**

**Date:** 2026-04-28
**Decision:** Retire the 3-OS Tauri build matrix and delete the stub.
**Plan:** [`docs/plans/wave42-tauri-decision.md`](plans/wave42-tauri-decision.md)

## Path picked: (B) Retire

Per the plan's §4 decision criteria, retire was the only defensible
path:

- **Promote (A)** requires ≥ 30 consecutive green runs of the matrix
  AND active intent to ship a desktop app. The last 20 recorded runs
  (2026-04-26) were 19 × `failure` + 1 × `cancelled`. Active intent is
  also absent — Tauri has been on the "deferred / explicitly out of
  scope" list in `docs/CLAUDE.md` for the life of the project.
- **Hold (C)** is procrastination on a permanently-red workflow with
  no concrete trigger to revisit. The strategic note in `CLAUDE.md`
  already serves as a "we'll consider this later" marker.
- **Retire (B)** is the action that matches reality.

## What shipped

- Deleted `.github/workflows/tauri.yml` (the 3-OS matrix).
- Deleted `app/src-tauri/` (Cargo.toml, build.rs, src/, tauri.conf.json,
  README.md — all stub, no real code).
- Removed the "Tauri desktop wrapper (stub dir exists; no code)" line
  from `docs/CLAUDE.md` "Deferred / explicitly out of scope".
- Added this decision doc + the plan file from the docs/wave38-43-plans
  branch.

## Re-evaluation trigger

If a desktop-distribution conversation reopens, restore from git
history:

```
git log --diff-filter=D --name-only -- '.github/workflows/tauri.yml' 'app/src-tauri/**'
git checkout <sha>^ -- .github/workflows/tauri.yml app/src-tauri
```

The deleted paths above are the breadcrumbs.

## Cost recovered

Workflow ran on every PR touching `app/src-tauri/**` or
`.github/workflows/tauri.yml`. With the stub gone, the trigger paths
also disappear, so the recovered runner-minutes are bounded but real
(more importantly: zero red-but-advisory checks cluttering PR status).
