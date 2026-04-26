import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('LeaseGuard a11y', () => {
  test('analyzed-lease view has no serious or critical WCAG 2 A/AA violations', async ({
    page,
  }) => {
    await page.goto('/');

    // Onboarding tour intercepts every interaction. Dismiss it before
    // running axe so the overlay isn't the only thing axe sees.
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();

    // Sample lease drives the parse → analyze pipeline; we want axe to
    // run against the loaded analyzed-lease state, not the empty shell.
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    await expect(findings.locator('button.finding-btn').first()).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
