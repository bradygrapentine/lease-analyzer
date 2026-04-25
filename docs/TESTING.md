# TESTING

Quick-reference testing strategy for LeaseGuard. Read this before adding a
new test file or diagnosing a flake.

## Philosophy

- **Pure modules tested pure.** Rule matchers, fact extractors, redline
  diff, audit-chain hashing, pack schema validators — all live in files
  with no DOM, no IDB, no worker, no clock. Test inputs/outputs directly
  and keep the assertion list small but exhaustive.
- **UI via RTL + user-event.** Component tests drive the real component
  tree from the user's perspective. Prefer `getByRole` with an accessible
  name over `getByTestId`. `user-event` (not `fireEvent`) — it plays back
  real click/type sequences with the correct microtask ordering.
- **jsdom limits you should know.** No `HTMLCanvasElement.getContext`,
  no `Worker`, no real IndexedDB, no `navigator.clipboard` by default.
  We patch around each gap explicitly (see below); never rely on jsdom
  magically matching a browser.

## Fixtures

- **PDFs are synthesized at runtime.** `src/parser/testFixtures.ts`
  exports `makePdf(pages[])` that builds a tiny PDF with `pdf-lib` in
  memory. **No binary fixtures are committed** — all test PDFs are
  generated from declarative block specs inside the test file.
- **Rule packs** are plain JSON objects constructed inline in the test.
- **Sample fixture output** for the bundled sample PDF is built via
  `scripts/build-sample-pdf.mjs` but isn't committed either.

## IndexedDB test pattern

Every IDB-backed module exports a `_reset<Db>ForTests()` helper that
nulls the cached `dbPromise` (and on the newer helpers also closes the
previous handle). Each IDB test follows the same dance:

```ts
beforeEach(async () => {
  _resetFooDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0)); // drain close queue
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(FOO_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
});
```

Two `setTimeout(0)` yields is the minimum needed for fake-indexeddb's
internal close queue to flush before `deleteDatabase` takes the lock.
If you skip the wait, a pending `put` from the prior test can race the
delete and surface as `InvalidStateError`. See
`app/src/workflow/bulkImport.test.ts` for the canonical pattern and
`app/src/App.panels.test.tsx` for the multi-DB variant.

For App-level tests that render `<App />` and exercise many panels, the
`beforeEach` additionally:

1. Opens + `.close()`s each cached handle before resetting, so the
   `_reset` call doesn't leave an orphan connection.
2. Installs a scoped `unhandledRejection` handler that swallows benign
   `InvalidStateError`/code-11 IDB-teardown noise (fire-and-forget
   `refreshAuditLog` / `listLeases` calls can still be in flight when
   the next test's `beforeEach` nulls the cache).

## Web Worker

The worker entry (`src/worker/leaseWorker.ts`) is a 2-line
`self.onmessage = handleRequest` binding that jsdom never executes.
The real logic lives in `src/worker/handleRequest.ts` (pure) and is
tested directly. End-to-end worker behavior is verified by
`src/worker/workerClient.test.ts` with a stub Worker implementation
injected via the client's `WorkerCtor` seam. If Worker bootstrap fails
(jsdom, no-ESM test host), the client falls back to `inlinePipeline`
which is also directly covered.

## Performance

- **50-page parseLease budget.** `src/parser/parseLease.perf.test.ts`
  asserts wall-clock < budget on a synthesized 50-page PDF.
- **200-page analyze bench.** `src/rules/perf.bench.test.ts` runs
  analyze N=3 iterations on a 200-page fixture and asserts median
  runtime against a generous ceiling. Flake guard: use the median, not
  the mean; never gate CI on absolute wall-clock under 100 ms.
- Bundle budget is enforced separately via `npm run check:budget`
  (`scripts/check-bundle-budget.mjs`).

## Coverage thresholds

Defined in `app/vite.config.ts` under `test.coverage.thresholds`.
Current floors: **stmt 95 / branch 87 / func 91 / line 95**. Actuals
as of 2026-04-18: 97.03 / 88.08 / 93.21 / 97.03. Floors leave ~2 points
of headroom on stmt/func/line and ~1 on branch so a single honest
regression doesn't break CI. Raise floors in lock-step with actuals;
never set a floor you don't already have headroom on.

Excludes: test/bench/stories files, barrels (`index.ts`), `main.tsx`,
`parser/env.d.ts`, `parser/testFixtures.ts`, and
`worker/leaseWorker.ts` (not reachable from jsdom).

### Per-file timeout exemption

`src/App.panels.test.tsx` is the only file that opts out of the global
5s per-test default. It mounts the full `<App />` with ~20 panels and
runs slower under v8 coverage instrumentation. The exemption is set via
`vi.setConfig({ testTimeout: 15_000 })` at the top of the file and
applies only to that file — the global default in `vite.config.ts`
stays at the Vitest 5s baseline. Don't extend this exemption to other
files without an equivalently explicit reason; the v8-coverage cost is
roughly proportional to the number of mounted panels per test, so most
files don't need it.

## Known flaky / noisy patterns to avoid

- **Don't render `<PdfViewer>` with real bytes in a jsdom test.** The
  canvas path fails + pdf.js worker bootstrap is slow enough to blow
  the 5s per-test timeout under coverage. Mock `./ui/renderPdfPages`
  at the top of the file (`App.panels.test.tsx` does this).
- **Don't `await` a fire-and-forget IDB call indirectly via
  `vi.waitFor`.** If the promise is rejected by a mid-flight teardown
  it still counts as unhandled. Use a scoped `unhandledRejection`
  handler that filters `InvalidStateError` / code 11.
- **Don't share a cached db handle across tests without a close.**
  Prefer the `_reset<Db>ForTests` pattern religiously — the one place
  we didn't (early `bulkImport.test.ts`) emitted intermittent
  `InvalidStateError` on the suite-wide run.

## When to add a browser-sanity walk

Trust jsdom for: rule logic, pack I/O, redline math, audit chain,
serialization, most UI wire-ups, form state. Reach for a browser
smoke test (chrome-devtools MCP) when the behavior is any of:

- Canvas / Worker / OffscreenCanvas / real OCR.
- PWA / service-worker install flow.
- `navigator.clipboard` with user-gesture gating.
- Real file-system-picker flows, drag-and-drop bubbling.
- IndexedDB quotas / migration behavior on Chromium specifically.

One browser walk per release is plenty; the smoke test's job is to
catch jsdom-shaped blind spots, not replace the unit suite.

## Run commands

```bash
# Fast inner loop (single file or pattern)
npm run test -- --run src/rules/packV1.test.ts
npm run test -- --run src/ui              # glob against dir

# Watch mode
npm run test:watch

# Full gate (what CI runs)
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:budget
```
