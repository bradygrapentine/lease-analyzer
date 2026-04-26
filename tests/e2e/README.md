# Playwright e2e smoke

A single happy-path browser test that exercises the user-facing pipeline
end-to-end against a real Chromium build:

1. Load the production preview build.
2. Dismiss the first-run onboarding tour.
3. Click "Try a sample lease" → parse → analyze.
4. Assert the findings panel populates with at least one finding.
5. Click the first finding → assert the selected-finding detail panel mounts.
6. Toggle to the Portfolio view → assert the portfolio region renders.
7. Toggle back, refresh the Audit Log → assert at least one entry is visible.

The unit suite under `app/src/**/*.test.tsx` is jsdom-only; the e2e job
covers the things jsdom can't: real canvas, real Web Worker bootstrap,
service-worker install, and the preview build's bundle wiring.

## Local

From the repo root:

```bash
# One-time: install Chromium + system deps.
npm run e2e:install

# Build the app and run the smoke. Playwright auto-starts `vite preview`
# on http://127.0.0.1:4173 via the webServer config in playwright.config.ts.
cd app && npm run build && cd ..
npm run e2e
```

`reuseExistingServer` is on outside CI, so an `npm run preview` already
running on :4173 is reused instead of being torn down.

## CI

`.github/workflows/e2e.yml` runs the same flow on every PR. Failure modes:

- Timeout on findings panel → analyze regression.
- Selected-finding article missing → click-to-highlight wire-up broke.
- Portfolio button has no effect → view-toggle regression.
- Audit-log section absent → audit pipeline regression.

The HTML report is uploaded as a build artifact when the job fails so
you can replay the trace + screenshots locally.

## a11y (`a11y.spec.ts`)

A second spec runs `@axe-core/playwright` against the analyzed-lease
view (sample-lease loaded, findings panel populated). It calls
`AxeBuilder.withTags(['wcag2a', 'wcag2aa'])` and fails the build on
any `serious` or `critical` impact violation. `moderate` / `minor`
impacts surface in the report but don't gate the merge — those are on
a separate manual-review track.

The unit-side companion is `app/src/ui/FindingsPanel.a11y.test.tsx`,
which uses `vitest-axe` against the most aria-heavy panel. The two
gates are intentionally redundant: the unit gate catches regressions
inside a single component, the e2e gate catches regressions caused by
how panels compose.

## Out of scope (deferred to later waves)

- WebKit / Firefox matrix.
- Visual regression snapshots.
- e2e for review-link / counter-sign / delta-packet flows (those need
  filesystem fixtures).
- Test parallelism beyond Playwright's defaults.
