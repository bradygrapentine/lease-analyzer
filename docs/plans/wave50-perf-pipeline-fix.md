# Wave 50 — Perf: Restore pdf.js Worker + Fix Concurrent Upload UX

**Goal.** Land the two highest-impact findings from
`docs/audits/perf-probe-2026-04-29.md`: restore the pdf.js worker so
PDF parsing stops blocking the main thread (analyze pipeline drops
from 15–25 s to an expected 1–3 s on small PDFs), and add an
`AbortController`/token-guard to `usePipeline.ts` so a new upload
pre-empts an in-flight analyze cleanly instead of leaving a stuck
"Analyzing X" status. After this wave, the canonical upload-to-findings
flow feels responsive and the live region tells the truth about which
file is currently being processed.

**Scope corresponds to:** perf-probe Slices 1 and 2.

**Out of scope** (deferred to Wave 51 housekeeping or Slice 3 of the
probe): font woff2 regeneration, audit-log quota rotation policy, CSP
`frame-ancestors` header migration. Each is real but lower per-user
impact and won't compound with the pipeline fix.

**Architecture.** Two pillars, one PR.

- **Pillar A (pdf.js worker restoration):** find where `pdfjs-dist` is
  imported and the `GlobalWorkerOptions.workerSrc` should be set
  (likely in `parser/parseLease.ts` or `parser/extractPages.ts`).
  Confirm the bundled `pdf.worker.min.js` chunk is reachable; fix the
  resolver if not. The fix is almost certainly a one-line `import
  workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'` plus
  `pdfjs.GlobalWorkerOptions.workerSrc = workerSrc`. Add a regression
  test that asserts no "Setting up fake worker" warning surfaces in
  the test runner's console during a parse.
- **Pillar B (pipeline pre-emption):** add a `currentTokenRef` to
  `usePipeline.ts`. Every upload increments the token. Async
  callbacks (`setStatus`, `safeAudit`, `pipeline.setError`) check
  the token before firing; mismatched-token callbacks no-op. Same
  pattern that resolves StrictMode double-invoked-effect races
  elsewhere in the codebase.

**Tech Stack.** React 18 + TypeScript strict, pdf.js, Vite 5, Vitest
+ RTL. No new dependencies.

**Base SHA.** `origin/main` after Wave 49 merged (`eb4c67e`). Verify
`git log origin/main --oneline -3 | grep "wave(49)"` before branching.

**Prerequisites.** Wave 49 merged (`eb4c67e`). Wave 47 and 48 plans
remain queued; Wave 50 is independent of both content-wise and should
be sequenced wherever you have capacity. The pdf.js worker fix is
self-contained enough to land before either of them.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave50-perf-pipeline-fix`.
2. **No new dependencies.** Reuse existing `pdfjs-dist` and `?url`
   import handling that Vite already provides for the OCR worker
   chunk.
3. **Pillar A must verify in production**, not just dev. Build via
   `npm run build`, serve `dist/` locally, re-probe the same flow.
   Confirm the "Setting up fake worker" message is gone AND analyze
   times match the expected bounds.
4. **Pillar B must not regress the existing "upload completes
   correctly" path.** Tests in `usePipeline.test.ts` already cover
   the happy path; add new tests for the pre-emption case, do not
   weaken existing ones.
5. **No behavioural change to the audit chain or signing path.**
   `safeAudit` calls keep firing per the existing schedule; the
   token guard wraps the *callback delivery*, not the IDB write.
6. **Local gate green** (`npm run typecheck && npm run lint && npm
   run test:coverage`) before push.
7. **Real-browser perf re-probe** before merge. Open `dist/` in
   Chrome via `chrome-devtools-mcp`, run the same upload flow used
   in the original probe, capture timing. Document the before/after
   numbers in the PR body.
8. **No `gh pr ready` while CI is red.** Per CLAUDE.md.
9. **Codex adversarial gate** before `gh pr ready`. The pre-emption
   logic in Pillar B is exactly the kind of small async-correctness
   change Codex catches well; budget 1–2 passes.

## §2 Out of scope

- **Font fix (`source-serif-4-400.woff2` decode failure).** Real
  visual regression but design-fidelity, not perf. Defer to Slice 3
  / Wave 51.
- **Audit-log quota rotation.** Probe surfaced a
  `QuotaExceededError` in dev; production exposure unclear. Needs
  its own measurement + design discussion, not a quick fix.
- **CSP `frame-ancestors` header migration.** Security finding,
  separate concern from pipeline perf.
- **OCR pipeline perf.** OCR is opt-in and already heavy by design;
  separate wave.
- **Bundle-size reduction (LCP render-delay tail).** 387 ms is
  acceptable on desktop; mobile-tier work is its own initiative.
- **Mobile/network throttled re-probe.** Run after this wave lands;
  any more aggressive optimization should be measured against the
  post-fix baseline, not the current dev-broken one.

## §3 Files in scope

**Pillar A — pdf.js worker:**
- Modify: `app/src/parser/parseLease.ts` (set `pdfjs.GlobalWorkerOptions.workerSrc` if not already set, and via the right path)
- Modify: `app/src/parser/extractPages.ts` (same — figure out which file owns the worker registration; likely just one)
- Modify: `vite.config.ts` if needed (the `?url` import handling for `pdf.worker.min.js`)
- Modify: `app/src/parser/parseLease.test.ts` — add a regression test that mocks `console.warn` and asserts "Setting up fake worker" never fires during a successful parse
- Modify: relevant Storybook stories or `tests/e2e/smoke.spec.ts` if they exercise the parser

**Pillar B — pipeline pre-emption:**
- Modify: `app/src/App/usePipeline.ts` (add `currentTokenRef` + token-check on every async setState callsite)
- Modify: `app/src/App/usePipeline.test.ts` (add: "second upload mid-analyze pre-empts the first; status reflects the second file; first file's setState callbacks no-op")
- Modify: `app/src/App.test.tsx` if any cross-cutting test relies on the prior stuck-status behaviour (unlikely)

**Documentation refresh:**
- Modify: `docs/audits/perf-probe-2026-04-29.md` — add a "Slice 1 + 2 shipped — Wave 50" header note pointing at the merged PR.
- Modify: `docs/BACKLOG.md` — promote findings #1 and #2 to `[x]`; file the deferred ones (#3 woff2, #4 audit quota, #5 silent rejections, #6 CSP header) under a "Wave 50 deferrals" section.

## §4 Item ordering

1. **Pillar A first.** Without the worker fix, perf measurements lie. Land + verify in production build before touching Pillar B.
2. **Pillar B second.** Pre-emption logic is small and self-contained; lands cleanly on top of A.
3. **Re-probe + doc refresh last.** PR body cites the new measured numbers.

## §5 Verification gates

1. **Console regression test.** During parse, `console.warn` is not called with `"Setting up fake worker"`. Asserted by Vitest.
2. **Real-browser perf re-probe.** Build production bundle (`npm run build`), serve `dist/`, drive the upload flow through `chrome-devtools-mcp` for `consumer-gov-basic.pdf` (162 KB) and `hud-90105a.pdf` (266 KB). Capture trace; assert analyze time < 5 s for the small PDF, < 8 s for the medium one.
3. **Pipeline pre-emption test.** `usePipeline.test.ts` covers: upload A; before A's analyze resolves, upload B; assert status reflects B, not A; assert A's late callbacks no-op (don't overwrite B's status).
4. **Local gate.** `npm run typecheck && npm run lint && npm run test:coverage` green; coverage on `usePipeline.ts` does not regress.
5. **CI.** `gh pr checks` all green, no pending. Lighthouse + smoke + verify + npm-audit clean.
6. **Codex adversarial gate.** Clean by ≤2 passes. Pillar B's async-correctness logic is the likely magnet; pre-build a property table mapping every "after pre-emption, X must be true" claim to a code-verifiable assertion in tests.

## §6 Risks and mitigations

- **Worker fix exposes a different perf issue underneath.** With the worker actually running, analyze time may still be slow because the rules engine or shingle indexing is slow. Mitigation: re-probe and write down whatever the new bottleneck is; defer to a follow-up wave only if it exceeds expected bounds.
- **Pillar B token guard masks a real bug.** If a callback that *should* fire is wrapped under the wrong token check, the user sees nothing. Mitigation: token check goes around UI updates only, never around audit writes or storage writes.
- **Vite's `?url` import contract changed.** The `?url` query param in dev vs. prod produces different paths in some configurations. Mitigation: explicitly verify both `npm run dev` and `npm run build && serve dist/` render the same path.
- **Workers have different module-loading rules under the project's CSP.** The CSP allows `worker-src 'self' blob:`. The bundled chunk needs to be served same-origin (it is); blob: is a fallback. If the worker still fails, the next move is to inline-bundle it via `?worker&inline` instead of `?url`.

## §7 Success definition

- Console no longer prints `"Setting up fake worker"` during a parse.
- Real-browser probe shows analyze time on `consumer-gov-basic.pdf` drops from ~17 s to ≤ 3 s.
- Uploading a second PDF mid-analyze updates the live region to the new filename within 100 ms.
- `usePipeline.test.ts` covers the pre-emption case with at least one test.
- `docs/audits/perf-probe-2026-04-29.md` gets a "Slice 1 + 2 shipped" header pointing at this PR's commit.
- BACKLOG reflects current truth: findings #1 and #2 promoted to Done; #3, #4, #5, #6 filed as Wave 50 deferrals.
