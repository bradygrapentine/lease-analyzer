import { test, expect } from '@playwright/test';

// Wave 25 Part A — Phase 18 smoke. The hybrid classifier path is wired
// into both OCR (Wave 23-B) and upload (Wave 24-A) pipelines, but the
// classifier assets aren't dropped in CI (Wave 23-A's downloader is a
// one-time manual step). The smoke contract here is narrow:
//
//   1. `?phase18=on` is recognized by the runtime feature flag and
//      doesn't crash the app on boot.
//   2. The sample-lease deterministic happy path still works with the
//      flag on (i.e. enabling Phase 18 doesn't regress the existing
//      regex pipeline when the classifier files are absent).
//   3. NO hybrid badge renders on the deterministic findings — the
//      classifier load fails cleanly (no assets) and the upload /
//      OCR fallbacks (Wave 23-B / 24-A) keep the deterministic
//      findings unchanged with no `evidence` payload.
//
// The real-model golden case (a paraphrased clause that ONLY the
// classifier catches) lives in Wave 25 Part C behind a `RUN_REAL_MODEL`
// env gate so it stays off PR CI until a nightly job is wired.

test.describe('Phase 18 flag-on smoke', () => {
  test('flag on + sample lease: deterministic findings render, no hybrid badge', async ({
    page,
  }) => {
    await page.goto('/?phase18=on');

    const skipTour = page.getByRole('button', { name: /skip onboarding tour/i });
    await skipTour.click();

    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    const findingButtons = findings.locator('button.finding-btn');
    await expect(findingButtons.first()).toBeVisible({ timeout: 15_000 });

    // Hybrid badge is the Wave 24-B span with this aria-label prefix.
    // Without classifier assets in CI, NO finding should carry one.
    const hybridBadges = findings.locator(
      '[aria-label^="Identified by on-device classifier"]',
    );
    await expect(hybridBadges).toHaveCount(0);
  });
});
