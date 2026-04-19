# LeaseGuard

> Private, local-first lease analyzer. Upload a PDF, get a prioritized list of
> clauses that matter. Nothing leaves your device.

## What it does

- **Parse** — extracts structured text from a lease PDF via pdf.js (runs
  entirely in your browser).
- **Analyze** — matches the text against a pack of 10 rules that flag
  common commercial/residential lease risks (auto-renewal, jury-waiver,
  indemnification, arbitration, rent escalation, etc.). Each finding includes
  severity, rationale, and the exact snippet that triggered it.
- **Compare** — diff two leases rule-by-rule, or mark one as your
  "standard" and auto-compare every new upload against it.
- **Persist** — IndexedDB-backed "My Leases" library, all on-device.
- **Export** — JSON or printable HTML per lease, or an encrypted archive
  (AES-GCM + PBKDF2) covering the whole library for backup.

## Privacy model

The app is shipped as a PWA with a strict Content-Security-Policy
(`default-src 'self'`). Once the HTML and JS are loaded, no network calls
are possible. PDFs, findings, and encrypted backups all stay in IndexedDB
or in downloads the user initiates explicitly.

LeaseGuard is **not legal advice**. Findings are heuristic pattern matches.

## Getting started

```bash
cd app
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

Key scripts:

| Command                    | What it does                                |
|----------------------------|---------------------------------------------|
| `npm run dev`              | Vite dev server with HMR                    |
| `npm run build`            | Production build (`dist/` + service worker) |
| `npm run preview`          | Serve the production build                  |
| `npm run typecheck`        | `tsc -b --noEmit` (strict mode)             |
| `npm run lint`             | ESLint across the project                   |
| `npm test`                 | Vitest run                                  |
| `npm run test:watch`       | Vitest watch mode                           |
| `npm run test:coverage`    | Vitest with v8 coverage + thresholds        |
| `npm run build:sample`     | Regenerate `public/sample.pdf` fixture      |

## Project layout

```
app/
  public/
    icon.svg           # PWA app icon
    sample.pdf         # "Try a sample lease" fixture (generated)
  scripts/
    build-sample-pdf.mjs
  src/
    App.tsx            # Top-level state machine (idle/loading/analyzed/error)
    parser/            # PDF → LeaseDocument (pdf.js, layout reconstruction)
    rules/             # Rule type, matchers, analyze(), rule pack v1
    compare/           # diffFindings, diffLeases, needsOcr
    storage/           # IndexedDB wrapper, exports, encrypted archive
    ui/                # FindingsPanel, LibraryPanel, PdfViewer, etc.
    test/              # Test setup + helpers
docs/
  README.md            # This file
  SYSTEM_DESIGN.md     # Architecture + data flow
  ROADMAP.md           # Phased plan
  BACKLOG.md           # Ticket-sized work, status-tracked
  CLAUDE.md            # Conventions + agent guide
```

## Testing philosophy

- **TDD end-to-end** — every new rule, matcher, and UI behavior has a failing
  test first. See commit history for the red → green pattern.
- **Fixtures generated in-test** — pdf-lib synthesizes residential and
  commercial leases so tests are reproducible without committing binaries.
- **Browser-level sanity walks** — Chrome DevTools MCP drives the dev server
  for flows jsdom can't cover (canvas rendering, file input semantics).
- **Coverage floor** — CI enforces 90% statements/lines/functions, 85%
  branches via `vitest --coverage`.

## Status

All 7 roadmap phases have concrete progress; see `ROADMAP.md` for the plan
and `BACKLOG.md` for remaining items. Significant deferred work: tesseract.js
OCR, span-level highlight overlay in the PDF viewer, full WCAG audit, Tauri
desktop wrapper.
