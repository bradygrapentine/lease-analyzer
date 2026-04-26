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
// KNOWN GAP (Wave 26): this spec currently FAILS even with assets
// present, because `loadClassifier.ts` doesn't configure
// `@xenova/transformers`'s `env.localModelPath` / `env.allowRemoteModels`
// — the runtime falls back to fetching from huggingface.co (which the
// upload-path then catches and silently degrades to deterministic-only,
// so no `llm-classify` audit entries fire and no hybrid badges render).
// Wave 25 Part C ships the spec as-is so the contract is documented
// and discoverable; Wave 26 fixes the loader and the spec will start
// passing without any spec edits.

const RUN_REAL_MODEL = process.env.RUN_REAL_MODEL === '1';

test.describe('Phase 18 real-model golden', () => {
  test.skip(!RUN_REAL_MODEL, 'set RUN_REAL_MODEL=1 to run the real classifier locally');

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

    // Capture CSP violations as they fire — the assertion at the end
    // catches any that surfaced during model boot.
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy/i.test(text) || /CSP/i.test(text)) {
        cspViolations.push(text);
      }
    });

    await page.goto('/?phase18=on');
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    // Deterministic findings appear first; classifier pass runs after
    // and re-renders. Give it generous time — model boot + embedding
    // can take several seconds on first load.
    const hybridBadges = findings.locator(
      'button.finding-llm-badge[aria-label*="on-device classifier"]',
    );
    await expect(hybridBadges.first()).toBeVisible({ timeout: 60_000 });

    // Click the first hybrid badge → inline detail panel surfaces the
    // modelId. The Wave 25-B affordance renders `<dl>` with `<dd>`
    // containing the literal model id string.
    await hybridBadges.first().click();
    await expect(findings.getByText('Xenova/paraphrase-MiniLM-L3-v2')).toBeVisible();

    expect(cspViolations, `CSP violations during real-model run:\n${cspViolations.join('\n')}`)
      .toEqual([]);
  });
});
