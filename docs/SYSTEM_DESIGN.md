# System Design

LeaseGuard is a single-page PWA. The entire pipeline — parsing, rule
evaluation, persistence, comparison, export — runs in the browser. There is
no backend.

## High-level flow

```
  ┌───────┐   pdf.js    ┌──────────────┐   rules    ┌──────────┐
  │  PDF  │ ─────────▶ │ LeaseDocument │ ─────────▶ │ Finding[] │
  └───────┘            └──────────────┘            └──────────┘
       │                       │                         │
       │                       ▼                         ▼
       │                ┌──────────────┐         ┌──────────────┐
       │                │   sections   │         │ FindingsPanel │
       │                └──────────────┘         └──────────────┘
       │                                                 │
       ▼                                                 ▼
  ┌──────────┐         IndexedDB              ┌───────────────────┐
  │ PdfViewer │ ◀───  LeaseRecord     ──▶   │  ComparePanel      │
  └──────────┘        { doc, findings }      └───────────────────┘
```

## Data model

```ts
// parser/types.ts
TextItem { text, x, y, width, height, fontSize }
PageText { pageNumber, width, height, items: TextItem[] }
Paragraph { text, page }
Section { heading, number, paragraphs, startPage }
LeaseDocument { pages, paragraphs, sections, raw }

// rules/types.ts
Rule {
  id, severity, category, title, explanation, citation,
  match: Matcher
}
Matcher = RegexMatcher | KeywordProximityMatcher | SectionAnchoredMatcher
Finding {
  ruleId, severity, category, title, explanation, citation,
  page, paragraphIndex, snippet, span, confidence, negated,
  rulePackVersion
}

// storage/storage.ts
LeaseRecord {
  id, name, createdAt, updatedAt, rulePackVersion,
  pageCount, findingCount, doc, findings
}
```

## Modules

### `parser/`

| File                  | Role                                              |
|-----------------------|---------------------------------------------------|
| `extractPages.ts`     | pdf.js wrapper → `PageText[]` with positions + fontSize |
| `paragraphs.ts`       | Line grouping (Y-tolerance), hyphen repair, header/footer stripping |
| `sections.ts`         | Heading detection (numbered + ALL CAPS), preamble fallback |
| `parseLease.ts`       | Composes extract → paragraphs → sections → `LeaseDocument` |
| `errors.ts`           | Maps pdf.js errors to typed app errors (PasswordProtectedPdfError) |
| `testFixtures.ts`     | pdf-lib-based synthetic PDFs for tests (excluded from coverage) |

### `rules/`

| File              | Role                                             |
|-------------------|--------------------------------------------------|
| `matchers.ts`     | `runRegex`, `runKeywordProximity`, `runSectionAnchored`, dispatcher `runMatcher` |
| `analyze.ts`      | Composes matchers into findings, applies negation post-filter, stable sort, stamps rule-pack version |
| `packV1.ts`       | 10 built-in rules (auto-renewal, early-termination, assignment, late-fees, attorney-fees, jury-waiver, arbitration, indemnification, rent-escalation, personal-guaranty) |

Matcher semantics:

- **regex** — one hit per paragraph on first match, confidence 0.9.
- **keywordProximity** — all keywords must appear within a character window;
  confidence 0.75.
- **sectionAnchored** — runs a leaf matcher only on paragraphs whose
  section heading matches a pattern.
- **negation-aware** — any finding whose snippet lives within 30 chars of a
  negation token (`not`, `shall not`, `without`, …) is emitted with
  `negated: true` and confidence × 0.5.

### `compare/`

- `diffFindings(a, b)` — classifies rule hits as added / removed /
  changed / unchanged (material equality on severity + negated).
- `diffLeases(a, b)` — aligns sections by case-insensitive heading and
  classifies each paragraph as added / removed / unchanged.
- `needsOcr(doc)` — flags likely-scanned PDFs via avg-chars-per-page < 100.

### `storage/`

| File                | Role                                               |
|---------------------|----------------------------------------------------|
| `storage.ts`        | idb wrapper, schema v2 (leases + settings stores), CRUD, standard-lease pointer |
| `exportReport.ts`   | JSON export (schema `leaseguard.findings.v1`)       |
| `exportHtml.ts`     | Printable HTML with `@media print` and XSS escape  |
| `archive.ts`        | Encrypted archive: AES-GCM + 200k-iter PBKDF2/SHA-256, 4-byte "LGv1" magic + 16-byte salt + 12-byte IV + ciphertext |

### `ui/`

| Component             | Role                                           |
|-----------------------|------------------------------------------------|
| `FindingsPanel`       | Grouped severity list, search, chips (severity + category), collapsible groups, keyboard nav |
| `PdfViewer`           | Canvas per page via `renderPdfPages`; scrollIntoView on selectedPage |
| `LibraryPanel`        | Saved leases, open / rename / delete, standard-lease badge |
| `ComparePanel`        | Rule-diff summary (added / removed / changed) |
| `LibraryCompareForm`  | Two-select picker for ad-hoc compares          |

### `App.tsx`

A state machine:
```
idle ──upload──▶ loading ──ok──▶ analyzed
             └─error──▶ error
```
On transition to `analyzed` the lease is persisted; if a standard lease is
set (and isn't the new one), the app auto-renders a `ComparePanel`.

## Privacy contract

- `index.html` ships with a strict Content-Security-Policy meta tag:
  `default-src 'self'; script-src 'self'; connect-src 'self' blob:;
  worker-src 'self' blob:; object-src 'none'; form-action 'none';
  frame-ancestors 'none'`.
- `pdf.worker` is bundled locally (no CDN).
- `vite-plugin-pwa` service worker precaches all assets for offline use and
  cannot reach the network for anything not already cached.
- Encrypted archive export/import uses WebCrypto — no server handshake.

## Known non-goals (for now)

Cloud sync, accounts, team collaboration, jurisdiction-specific legal
reasoning, LLM-based summarization.

## Performance budget

- 50-page parse < 3s (measured ~210ms in CI on the synthetic fixture).
- Coverage floor: 90% statements / functions / lines, 85% branches.

## Testing model

Tests colocate with code (`foo.ts` + `foo.test.ts`). pdf-lib generates
reproducible fixture PDFs at test time. `fake-indexeddb/auto` is registered
in the global test setup so storage tests run without a browser.
