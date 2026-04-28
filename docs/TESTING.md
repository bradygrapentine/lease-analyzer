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
Current floors: **stmt 96 / branch 90 / func 93 / line 96** (ratcheted
2026-04-28 in Wave 43). Actuals as of 2026-04-28: 97.56 / 90.29 /
94.27 / 97.56.

Ratchet rule: new floor = `floor(actual) - 1`, clamped never to
decrease. Wave 43 stepped stmt/func/line up to 96/93/96; branch
headroom (0.29) was below the 2-point margin so the branch floor
held at 90. Limiter files for any future branch push:
`src/worker/handleRequest.ts` (71.42), `src/parser/customRuleDraft.ts`
(79.41), and `src/ui/renderPdfPages.ts` (77.77).

Floors leave ~1.5 points of headroom on stmt/line, ~1.3 on func,
~0.3 on branch — branch is the tight one because the two structural
ceilings on the codebase keep it sticky:

- `App.tsx` decomposition (Waves 17–21) trimmed it 1007 → 541 lines;
  remaining branch headroom now comes from continued extraction OR
  from the next surgical guard sweep.
- `noUncheckedIndexedAccess` produces `?? 0` / `?? ''` defensive
  guards that v8 counts as branches but that runtime cannot reach.
  Wave 24-C dropped the unreachable subset in `hybridAnalyze.ts`
  (loop-bounded indexed accesses); these still show up across the
  parser / matchers / diff code and remain permanently uncovered
  branches there.

Raise floors in lock-step with actuals; never set a floor you don't
already have headroom on.

Excludes: test/bench/stories files, barrels (`index.ts`), `main.tsx`,
`parser/env.d.ts`, `parser/testFixtures.ts`, and
`worker/leaseWorker.ts` (not reachable from jsdom).

### a11y gate (separate axis)

a11y is enforced separately from coverage. Two redundant gates:

- **Unit:** `app/src/ui/FindingsPanel.a11y.test.tsx` runs `vitest-axe`
  against the most aria-heavy panel in three states (empty, single
  severity, full pack). Helper lives in `app/src/test/axe.ts`.
- **e2e:** `tests/e2e/a11y.spec.ts` runs `@axe-core/playwright`
  against the analyzed-lease view loaded via the sample-lease button.
  Filters to `wcag2a` + `wcag2aa` tags; fails the build on any
  `serious` or `critical` impact violation.

Both must be green. They're a separate axis from coverage thresholds —
coverage is "did the test exercise the code", a11y is "does the rendered
output meet WCAG". A coverage regression and an a11y regression can
land independently.

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

## End-to-end (Playwright)

Specs live in `tests/e2e/`; `playwright.config.ts` at the repo root
boots the production preview (`app/dist/`) on port 4173. CI runs
the matrix across chromium / firefox / webkit on every PR.

The Phase 18 real-model golden case (`tests/e2e/hybrid-golden.spec.ts`)
is gated behind `RUN_REAL_MODEL=1` so it stays off PR CI. To run
locally:

```bash
cd app
npm run build:classifier-assets   # one-time, drops weights into public/classifier
npm run build
cd ..
RUN_REAL_MODEL=1 npx playwright test --project=chromium tests/e2e/hybrid-golden.spec.ts
```

First-run wall time on the local box: roughly 30–60 s (16 MiB ONNX
fetch + WASM init + per-paragraph embedding). Subsequent runs reuse
the browser's HTTP cache and complete in a couple of seconds. The
spec disables service-worker registration before navigation so the
SW precache doesn't race with the direct fetch (Chromium throws
`ERR_CACHE_WRITE_FAILURE` on the 16 MiB file under that race).

## Hybrid quality reporting

The Phase 18 hybrid path emits two audit kinds — `llm-classify` (per
finding) and `hybrid-feedback` with `signal: 'not-relevant'` (per user
reject). Wave 30-A's `HybridPrecisionPanel` surfaces per-rule precision
live in the running app. Wave 35 Part A adds a Node-only offline
report that runs against an exported audit chain so the precision
table can be captured for review (e.g. in PR descriptions when
deciding whether to demote noisy `hybridAnchors`).

Flow:

1. In the running app, click `Export audit log` to download a
   `leaseguard-audit-*.json` file (schema `leaseguard.audit.v1`).
2. From `app/`, run:

   ```bash
   npm run hybrid:stats -- /path/to/leaseguard-audit-2026-04-28.json
   ```

3. The script prints a per-rule markdown table (`ruleId | fires |
   rejects | precision`) and a one-line decision: `ACT` if any rule
   has `fires ≥ 10 AND precision < 0.70`, `NO-OP` otherwise.

The script is pure Node (no jsdom, no browser); the test fixtures live
in `app/scripts/hybrid-stats-report.test.mjs` and exercise the rich /
sparse / empty branches plus the defensive precision-clamp path.

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
