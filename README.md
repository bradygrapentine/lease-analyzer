# LeaseGuard

Private, local-first lease analyzer. Upload a PDF, get a prioritized
list of clauses that matter. Nothing leaves your device.

## Why local-first

LeaseGuard is a single-page PWA with a strict
`default-src 'self'` Content-Security-Policy and a service worker that
precaches every asset. Once the HTML and JS are loaded, the app cannot
make network calls. Parsing, rule-matching, comparison, redlining,
signing, and audit all run in the browser. Persistence is nine
independent IndexedDB databases — there is no server, no telemetry, no
account.

## What it does

Analyze a lease against a pack of 10 built-in rules (auto-renewal,
jury-waiver, indemnification, arbitration, rent escalation, and
others). Redline paragraphs and snapshot versions as you negotiate.
Compare any two leases rule-by-rule, or mark one as your "standard"
and auto-compare every new upload against it. Everything the app does
writes to an append-only, hash-chained audit log, and findings can be
exported as Ed25519-signed JSON. Rule packs can be imported in a
signed envelope; the app verifies before installing.

## Quickstart

```bash
cd app
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

Other scripts (all from `app/`):

| Command                | What it does                                |
|------------------------|---------------------------------------------|
| `npm run build`        | Production build (`dist/` + service worker + leaseWorker chunk) |
| `npm run preview`      | Serve the production build                  |
| `npm run typecheck`    | `tsc -b --noEmit` (strict)                  |
| `npm run lint`         | ESLint (0 warnings expected)                |
| `npm test`             | Vitest run                                  |
| `npm run test:coverage`| Vitest with v8 coverage + thresholds        |
| `npm run storybook`    | Panel previews on :6006                     |
| `npm run check:budget` | Bundle-size budget gate                     |

## Docs

All developer-facing documentation lives in [`docs/`](./docs/). Start
with [`docs/README.md`](./docs/README.md) for a table of contents and
[`docs/CLAUDE.md`](./docs/CLAUDE.md) for coding conventions.

## Status

Footprint (tests, coverage, bundles, IDB schema versions) is tracked in
[`docs/BACKLOG.md`](./docs/BACKLOG.md) at the top of the file.
[`docs/ROADMAP.md`](./docs/ROADMAP.md) covers the phased plan;
[`docs/BACKLOG.md`](./docs/BACKLOG.md) is the authoritative ticket
list.

## Third-party assets

The bundled tesseract.js OCR runtime, WebAssembly engine, and English
trained-data file are Apache License 2.0; attributions live in
[`app/public/NOTICE`](./app/public/NOTICE) (also reachable at `/NOTICE`
from any installed instance of the PWA). See
[`docs/SECURITY.md`](./docs/SECURITY.md) §5 for the redistribution model
and re-review triggers.

## Not legal advice

Findings are heuristic pattern matches. LeaseGuard flags things worth a
closer look; it doesn't render legal opinions.
