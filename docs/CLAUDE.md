# Agent guide — LeaseGuard

## Build order

`parser → rules → UI → storage → compare`. The order the codebase was built
in; follow it when adding new end-to-end features so each layer has the
primitives it needs.

## Commands

All run from `app/`:

```
npm run dev               # Vite dev server (localhost:5173)
npm run typecheck         # tsc -b --noEmit, strict + noUncheckedIndexedAccess
npm run lint              # eslint
npm test                  # Vitest
npm run test:coverage     # Vitest + v8 coverage (CI enforces thresholds)
npm run build             # tsc + vite build; emits sw.js
npm run build:sample      # regenerate public/sample.pdf
```

Default gate sequence before a commit: `typecheck && lint && test:coverage`.
For UI changes, also `npm run dev` + browser sanity walk — jsdom doesn't
cover canvas rendering, file-input semantics, or scroll.

## Coding conventions

- Strict TS: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
  Use `src/test/assert.ts` helpers (`at`, `defined`) in tests to satisfy
  the indexed-access rule without scattered `!` assertions.
- Pure modules first, React last. Parser/rules/compare/storage are all
  synchronous or Promise-returning pure-ish functions. UI components
  take the output of those as props.
- No barrel files shouldering logic — `src/**/index.ts` are re-exports
  only and are excluded from coverage.
- Keep comments minimal. Explain *why* (a non-obvious constraint) rather
  than *what* (the code already says that).
- CSP is a hard constraint. Do not add network-fetching features or third-
  party script/font/image sources. If a dep wants a CDN worker, bundle it.

## Data handling gotchas

- `pdf.js` **transfers ownership** of the ArrayBuffer passed to
  `getDocument({ data })`. App keeps one copy for the parser and another
  for the viewer; StrictMode double-effects also copy defensively inside
  `renderPdfPages`. See `App.tsx` and `PdfViewer.tsx` for the pattern.
- IndexedDB tests must close any open db, null out the cached
  `dbPromise` via `_resetDbForTests`, and `deleteDatabase` before each
  test. See `storage.test.ts` `wipe()` helper.
- `File` in jsdom lacks `arrayBuffer()`; `readFileBytes` in `App.tsx`
  falls back to `FileReader` for that environment.

## Adding a rule

1. Append to `src/rules/packV1.ts` with a unique `id`, severity, category,
   and a matcher.
2. Add a positive-case fixture to the parameterized test in
   `src/rules/packV1.test.ts`.
3. Consider whether any commercial or residential golden fixture in
   `src/rules/golden.test.ts` should now expect the new rule id, and
   whether the "not-in-other" assertion needs updating.
4. Prefer `keywordProximity` over regex when the clause has variable
   phrasing. Reserve regex for anchors like `\bauto[- ]?renew\b`.

## Adding a matcher type

1. Extend the `Matcher` union in `src/rules/types.ts`.
2. Add a `run*` function in `src/rules/matchers.ts` and a dispatch arm in
   `runMatcher`.
3. TDD the new matcher with at least one positive, one negative, and one
   edge case.
4. Add to the SYSTEM_DESIGN matcher-semantics table.

## Testing patterns

- Co-locate tests: `foo.ts` + `foo.test.ts`.
- Use `pdf-lib` via `src/parser/testFixtures.ts` to synthesize lease PDFs
  in-memory — no binary fixtures in the repo.
- RTL + `@testing-library/user-event` for UI components.
- For state machines in App tests, mock `window.prompt` / `window.confirm`
  via `vi.spyOn`, not by monkeypatching globals.

## Deferred / explicitly out of scope

- OCR (tesseract.js) — `needsOcr` only warns; no fallback engine yet.
- Span-level highlight overlay in the PDF viewer.
- Full WCAG 2.1 AA audit.
- Tauri desktop wrapper.
- Cloud sync / accounts / telemetry.

When a task touches one of these, ask before pulling in a dep — they all
have non-trivial bundle-size or architectural consequences.
