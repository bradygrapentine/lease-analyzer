# LeaseGuard docs

Developer-facing documentation for the LeaseGuard codebase. User-facing
README (project overview, quickstart) is at the repository root.

## Contents

| File | What it covers |
|------|----------------|
| [`ROADMAP.md`](./ROADMAP.md) | Phased plan for the product — the "why" and approximate sequencing. |
| [`BACKLOG.md`](./BACKLOG.md) | Ticket-sized work items, status-tracked. Contains the current footprint table (tests, coverage, bundles, IDB schema versions). |
| [`CLAUDE.md`](./CLAUDE.md) | Agent guide — coding conventions, commands, data-handling gotchas, how to add a rule / matcher / panel. Read this first if you're making code changes. |
| [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) | Architecture — layer diagram, the `usePipeline` state machine, worker boundary, 9-database IndexedDB landscape, signing + audit flow. |
| [`RULES.md`](./RULES.md) | Rule-authoring guide — matcher cookbook, optional Rule fields, pack import/export + signing flow. |
| [`TESTING.md`](./TESTING.md) | Testing model — see that file for coverage floors, fixture strategy, and test-harness conventions. |

## Finding things

- **"How does upload work?"** `SYSTEM_DESIGN.md` → *usePipeline state machine* and *Worker boundary*. Source: `app/src/App/usePipeline.ts`.
- **"Where does this data live?"** `SYSTEM_DESIGN.md` → *IndexedDB landscape*. Nine databases, all `leaseguard*`.
- **"How do I add a rule?"** `RULES.md`, then the checklist in `CLAUDE.md` → *Adding a rule*.
- **"How do I add a panel?"** `CLAUDE.md` → *Adding a panel*.
- **"What's deferred?"** `CLAUDE.md` → *Deferred / explicitly out of scope*, and the `[ ]` items in `BACKLOG.md`.
