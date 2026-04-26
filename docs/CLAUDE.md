# Agent guide — LeaseGuard

## What the app actually is now

LeaseGuard is a local-first, single-page PWA for reviewing lease PDFs. The
pipeline — parse, rule-match, compare, redline, sign, audit — runs entirely
in the browser with no network egress after load. The pipeline is driven
by a central `usePipeline` hook (upload → parse → analyze → save →
auto-compare) that dispatches the heavy work to a dedicated Web Worker.
Persistence is split across nine IndexedDB databases, rule packs can be
signed / verified with Ed25519, and every significant user action fans
out to an append-only hash-chained audit log.

## Build order

The layering the codebase grew into, roughly inside → out:

`parser → rules → UI → storage → compare → facts → signing → audit →
redline → versioning`.

Not rigid, but a useful check: each layer should only reach "leftward".
The parser has no UI knowledge; the rules engine knows nothing about
storage; the UI consumes pure-ish outputs from the lower layers. Signing
sits above storage because it operates on already-persisted artifacts
(pack envelopes, finding exports). Audit is a leaf — everything else may
write to it, but it imports nothing outside `audit/`.

## Commands

All run from `app/`:

```
npm run dev               # Vite dev server (localhost:5173)
npm run typecheck         # tsc -b --noEmit, strict + noUncheckedIndexedAccess
npm run lint              # eslint (0 warnings expected)
npm test                  # Vitest
npm run test:coverage     # Vitest + v8 coverage (CI enforces thresholds)
npm run build             # tsc + vite build; emits sw.js + leaseWorker chunk
npm run build:sample      # regenerate public/sample.pdf
npm run build:example-pack # regenerate the example rule pack fixture
npm run check:budget      # size-budget gate for app shell / pdf.worker / OCR
npm run lhci              # Lighthouse CI (a11y >=95, best-practices >=90, PWA-installable audits); see app/lighthouserc.json
npm run storybook         # panel previews on :6006
```

Default gate sequence before a commit: `typecheck && lint && test:coverage`.

A repo-root `package.json` wires `husky` + `lint-staged` so a `pre-commit`
hook runs `eslint --fix` and `prettier --write` on staged `app/**` files.
Run `npm install` at the **repo root** once after cloning to install the
hook (`prepare` script). CI is still authoritative — the hook is a fast
local feedback loop. Escape hatch is `git commit --no-verify`; do not use
it by default.
Coverage floors move with the test-hardening work — see `docs/TESTING.md`
for the authoritative numbers rather than hardcoding them here. For UI
changes, also `npm run dev` + browser sanity walk; jsdom doesn't cover
canvas, file-input semantics, IntersectionObserver, or real worker
behavior.

## Coding conventions

- Strict TS: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
  Use `src/test/assert.ts` helpers (`at`, `defined`) in tests to satisfy
  the indexed-access rule without scattered `!` assertions.
- Pure modules first, React last. Parser, rules, compare, storage,
  redline, versioning, signing are all synchronous or Promise-returning
  pure-ish functions. UI components consume their outputs.
- No barrel files shouldering logic — `src/**/index.ts` are re-exports
  only and are excluded from coverage.
- Keep comments minimal. Explain *why* (a non-obvious constraint) rather
  than *what* (the code already says that).
- CSP is a hard constraint. Do not add network-fetching features or
  third-party script/font/image sources. If a dep wants a CDN worker,
  bundle it locally.
- React-refresh discipline: only export components from `.tsx` files the
  fast-refresh boundary watches. Non-component exports live in plain
  `.ts` siblings.

## Data handling gotchas

- **StrictMode-safe ArrayBuffer copying.** `pdf.js` transfers ownership
  of the ArrayBuffer passed to `getDocument({ data })`. StrictMode's
  double-invoked effects would detach the buffer on the second pass.
  Hand every pdf.js call a dedicated copy via the shared
  `copyBytes(bytes)` helper in `parser/copyBytes.ts`. The viewer keeps
  one copy; `usePipeline` hands the worker another; OCR gets its own.
- **Worker transfer contract.** `createWorkerPipelineClient` transfers
  `bytes.buffer` to the worker, so callers must hand in a copy. The
  auto-selected `createLeaseWorkerClient()` falls back to the inline
  pipeline (same main-thread behavior as before) when `typeof Worker ===
  'undefined'`, which is the test environment.
- **Structured-clone shapes.** Everything that crosses the worker
  boundary — `LeaseDocument`, `Rule`, `Finding` — is plain data. No
  class instances, no functions, no bound RegExp objects. Compiled
  rules with `__compiled` are stripped before transfer and recompiled
  inside the worker.
- **`_reset<Db>ForTests` IDB pattern.** Every IndexedDB module exports a
  `_reset<Name>DbForTests()` that nulls its cached `dbPromise` and
  closes the current handle so `deleteDatabase` won't be blocked. Tests
  call the reset, then `indexedDB.deleteDatabase(NAME)` in their
  `beforeEach`. See `App.panels.test.tsx` for the canonical wipe across
  all nine databases.
- **`safeAudit()` wrapper.** Audit writes fire from many pipeline paths.
  The wrapper in `App.tsx` (`safeAudit({ kind, payload })`) awaits
  `appendAuditEntry` inside a `try/catch` — on failure it `console.warn`s
  and returns. Audit must never abort the caller.
- **IDB tx + WebCrypto.** Don't `await crypto.subtle.*` inside an open
  IDB transaction; the microtask tick auto-commits the tx. `appendAuditEntry`
  demonstrates the read → hash → write three-step pattern.
- **`File.arrayBuffer()` in jsdom.** Missing in jsdom; `readFileBytes`
  in `App.tsx` falls back to `FileReader`.

## Adding a rule

1. Append to `src/rules/packV1.ts` with a unique `id`, severity, category,
   and a matcher. Optional: `jurisdictions`, `plainEnglish`, `suggestedEdit`.
2. Add a positive-case fixture to the parameterized test in
   `src/rules/packV1.test.ts`.
3. Consider whether any commercial or residential golden fixture in
   `src/rules/golden.test.ts` should now expect the new rule id, and
   whether the "not-in-other" assertion needs updating.
4. Prefer `keywordProximity` over regex when the clause has variable
   phrasing. Reserve regex for anchors like `\bauto[- ]?renew\b`.
5. See `docs/RULES.md` for the full authoring guide (including the
   signed-pack import flow and compiled-rule cache).

## Adding a matcher type

1. Extend the `Matcher` union in `src/rules/types.ts`.
2. Add a `run*` function in `src/rules/matchers.ts` and a dispatch arm
   in `runMatcher`. Thread the optional `CompiledMatcherCache` through.
3. Extend `compileRules.ts` so the new matcher contributes to the cache.
4. TDD the matcher with at least one positive, one negative, and one
   edge case.
5. Add the semantics row to SYSTEM_DESIGN's matcher table.

## Adding a panel

New UI panels live in `src/ui/` and follow a four-file convention:

1. **Component**: `src/ui/FooPanel.tsx` — presentational; takes plain
   data + callbacks. Don't reach into IDB or audit directly from the
   component.
2. **Test**: `src/ui/FooPanel.test.tsx` — RTL + `user-event`; cover the
   empty state, loaded state, and one error/edge path.
3. **Story**: `src/ui/FooPanel.stories.tsx` — Storybook 8 CSF. Covers
   the same states as the test, for manual review.
4. **App wire-up** (optional): if the panel renders in `App.tsx`, pick
   a view mode (`current` / `portfolio` / `redline`) and gate it with
   `status.kind === 'analyzed'` where relevant. Mount behind the
   existing `<ErrorBoundary>`.
5. **Audit events**: any action the panel triggers that mutates
   persisted state should go through `safeAudit(...)`. Use an existing
   `kind` (`analyze`, `export`, `import-pack`, `pack-signature-verified`,
   `pack-signature-invalid`, `save-lease`, `delete-lease`, `bulk-import`,
   `custom-rule-save`, `redline-edit`, `version-save`, `version-restore`,
   `version-delete`, `llm-classify`) or add a new one — `kind` is a
   free-form string. `llm-classify` fires once per Phase 18 hybrid
   finding (Wave 22-A); payload includes `{ ruleId, paragraphIndex,
   modelId, similarity }`.
6. **Hybrid-finding badge** (Wave 24-B / 25-B): `FindingsPanel`
   renders a `finding-llm-badge` button next to each finding carrying
   `evidence: { modelId, similarity }`; the button's `aria-label`
   exposes the similarity percentage so screen readers convey
   provenance. Clicking the badge toggles an inline `<dl>` (modelId,
   similarity %, threshold context) for users who want the raw
   provenance — no new audit `kind`, no IDB writes, read-only over
   `Finding.evidence`. Deterministic findings render no badge.

## Testing patterns

- Co-locate tests: `foo.ts` + `foo.test.ts`.
- Use `pdf-lib` via `src/parser/testFixtures.ts` to synthesize lease PDFs
  in-memory — no binary fixtures in the repo.
- RTL + `@testing-library/user-event` for UI components.
- For state machines in App tests, mock `window.prompt` / `window.confirm`
  via `vi.spyOn`, not by monkeypatching globals.
- Worker-boundary tests inject a `PipelineClient` stub through
  `usePipeline`'s `pipelineClient` option — don't try to instantiate a
  real `Worker` in jsdom.

## Deferred / explicitly out of scope

- Span-level highlight bbox computation. Wave 15-C shipped viewport
  clipping + `prefers-reduced-motion` opt-out on the existing paragraph
  bbox; per-span bbox highlighting is tracked as a planned follow-up
  wave because `Finding.span` is `{start, end}` char offsets, not a
  bbox — the parser needs to attach a per-span bounding box first.
  See the BACKLOG row under Phase 8.
- Full WCAG 2.1 AA audit.
- Tauri desktop wrapper (stub dir exists; no code).
- Cloud sync / accounts / telemetry.
- Pre-commit hooks via `lint-staged` (CI is authoritative).

When a task touches one of these, ask before pulling in a dep — they all
have non-trivial bundle-size or architectural consequences.
