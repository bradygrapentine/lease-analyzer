import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Wave 25 Part C — real-model golden case.
//
// Env-gated behind RUN_REAL_MODEL=1 so it stays off PR CI until Wave 26
// wires a nightly job. The contract:
//
//   1. Phase 18 flag on (`?phase18=on`).
//   2. Classifier asset bundle present at `app/dist/classifier/` (the
//      one-time output of `npm run build:classifier-assets` from
//      Wave 23-A).
//   3. Sample lease analyzed. At least one finding carries
//      `evidence.modelId === 'Xenova/paraphrase-MiniLM-L3-v2'` —
//      proving the classifier ran end-to-end (asset fetch → ONNX
//      runtime boot → embedding → cosine sim → Finding emission).
//   4. Clicking the badge (Wave 25-B affordance) reveals the modelId
//      in the inline `<dl>`.
//   5. Zero CSP violations in the page console.
//
// Locally:
//
//   cd app && npm run build:classifier-assets   # one-time
//   cd app && npm run build
//   RUN_REAL_MODEL=1 npx playwright test --project=chromium tests/e2e/hybrid-golden.spec.ts
//
// Without `RUN_REAL_MODEL=1`, the spec is skipped entirely.
//
// SW INTERFERENCE (test-only quirk): the production Workbox service
// worker precaches the 16.6 MiB ONNX file at install time. In a fresh
// Playwright profile the SW install + transformers' direct fetch race
// for the HTTP cache and one of them throws ERR_CACHE_WRITE_FAILURE.
// In a real browser with persistent storage this is a non-issue —
// users hit a primed cache on second load. The spec unregisters the
// SW before driving the flow so the model is fetched once, directly,
// with no cache contention.

const RUN_REAL_MODEL = process.env.RUN_REAL_MODEL === '1';

test.describe('Phase 18 real-model golden', () => {
  test.skip(!RUN_REAL_MODEL, 'set RUN_REAL_MODEL=1 to run the real classifier locally');
  // Model boot + 16 MiB ONNX fetch + per-paragraph embedding eats well
  // past the default 30s. Override per-test rather than the whole config.
  test.setTimeout(120_000);

  test('flag on + classifier assets present: hybrid finding rendered with badge + modelId', async ({
    page,
  }) => {
    // Pre-flight: fail fast with an actionable message if the classifier
    // bundle wasn't dropped, rather than mid-test on a 404.
    const assetsDir = resolve(process.cwd(), 'app', 'dist', 'classifier');
    expect(
      existsSync(assetsDir),
      'classifier assets missing — run `cd app && npm run build:classifier-assets && npm run build` first',
    ).toBe(true);

    // Capture real CSP violations as they fire — the assertion at the
    // end catches any that surfaced during model boot. Chromium also
    // logs an informational warning about `frame-ancestors` being
    // ignored when delivered via a <meta> element; that's not a
    // violation (it's a known platform limitation, not blocked
    // content), so filter it out.
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/frame-ancestors.*ignored.*meta/i.test(text)) return;
      if (/Content Security Policy/i.test(text) || /Refused to/i.test(text)) {
        cspViolations.push(text);
      }
    });

    // Disable service-worker registration BEFORE the page boots so the
    // first navigation never installs Workbox. This avoids the SW vs.
    // direct-fetch race on the 16 MiB model file (see SW INTERFERENCE
    // note in the file header).
    await page.addInitScript(() => {
      if ('serviceWorker' in navigator) {
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          get: () =>
            ({
              register: (): Promise<never> =>
                Promise.reject(new Error('SW disabled for test')),
              ready: new Promise(() => undefined),
              addEventListener: (): void => undefined,
              getRegistrations: (): Promise<never[]> => Promise.resolve([]),
            }) as unknown as ServiceWorkerContainer,
        });
      }
    });

    await page.goto('/?phase18=on');
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();

    // First proof the classifier actually ran: an `llm-classify` audit
    // entry. Audit log isn't virtualized so this is the stable signal
    // for "the classifier emitted findings". Model boot + embedding can
    // take well past 30s on first load (16 MiB ONNX fetch + WASM init).
    // The audit log doesn't auto-refresh between actions; it does
    // refresh after analyze completes, but before the classifier finishes
    // it may not yet show the entry — poll by clicking Refresh.
    const refreshAudit = page.getByRole('button', { name: /^refresh$/i });
    await expect
      .poll(
        async () => {
          await refreshAudit.click();
          return page.locator('table[aria-label="audit entries"] td').allTextContents();
        },
        { timeout: 90_000, intervals: [2_000] },
      )
      .toContain('llm-classify');

    // Then prove the badge renders + the click-to-explain disclosure
    // (Wave 25-B) surfaces the modelId. The findings panel is
    // virtualized: each `<li data-finding-key=...>` mounts as a
    // placeholder when offscreen and only swaps in the full content
    // (badge included) once `useInViewport` reports it visible. Walk
    // every li and scroll it into view; stop on the first one whose
    // mounted content carries a hybrid badge.
    const lis = findings.locator('li[data-finding-key]');
    const liCount = await lis.count();
    let badge = null;
    for (let i = 0; i < liCount; i++) {
      const li = lis.nth(i);
      await li.scrollIntoViewIfNeeded();
      const candidate = li.locator('button.finding-llm-badge');
      if ((await candidate.count()) > 0) {
        badge = candidate;
        break;
      }
    }
    expect(badge, 'expected at least one hybrid-finding row to carry a badge').not.toBeNull();
    await badge!.click();
    await expect(findings.getByText('Xenova/paraphrase-MiniLM-L3-v2')).toBeVisible();

    expect(cspViolations, `CSP violations during real-model run:\n${cspViolations.join('\n')}`)
      .toEqual([]);
  });
});
