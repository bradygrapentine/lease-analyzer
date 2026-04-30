import { test, expect } from '@playwright/test';

test.describe('LeaseGuard happy path', () => {
  test('analyze sample lease, navigate findings, switch views, see audit entries', async ({
    page,
  }) => {
    await page.goto('/');

    // First-run onboarding tour intercepts every interaction. Dismiss it.
    const skipTour = page.getByRole('button', { name: /skip onboarding tour/i });
    await skipTour.click();

    // Sample-lease button kicks the parse → analyze pipeline.
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    // Findings panel populates once analyze completes. The sample lease is
    // hand-tuned to fire several rules; "at least one" is the contract.
    // Each clickable finding row has the `finding-btn` class — that's the
    // stable selector (filter / severity / category buttons live in the
    // same panel).
    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    const findingButtons = findings.locator('button.finding-btn');
    await expect(findingButtons.first()).toBeVisible({ timeout: 15_000 });

    // Click the first finding → the FindingDetailModal mounts (Wave 51-D
    // promoted the inline article landmark to a real `role="dialog"`).
    // Asserting the dialog is the smallest stable signal the click
    // wired through. Filter to the post-onboarding modal — OnboardingTour
    // also renders a dialog in this state.
    await findingButtons.first().click();
    await expect(page.getByRole('dialog').last()).toBeVisible();
    // Modal `inert`-locks the rest of the page; dismiss before tab click.
    await page.keyboard.press('Escape');

    // Portfolio toggle → portfolio section renders.
    await page.getByRole('tab', { name: /^portfolio$/i }).click();
    await expect(page.getByRole('region', { name: /portfolio/i }).first()).toBeVisible();

    // Wave 53-B-1: audit log is now its own top-level view (peer of
    // Current / Portfolio / Redline). Click the Audit tab directly.
    await page.getByRole('tab', { name: /^audit$/i }).click();

    // Audit log: section always exists; assert ≥ 1 entry from the analyze + save
    // events the sample-lease flow already produced. The panel renders a
    // <Refresh> control then a list of entries; the entries surface as
    // either <li> or <tr>, so we look for any visible row of the audit log.
    const auditSection = page.getByRole('region', { name: /audit log/i });
    await expect(auditSection).toBeVisible();
    await page.getByRole('button', { name: /^refresh$/i }).click();
    // Match any descendant element that looks like an entry row.
    const auditEntries = auditSection.locator('li, tr');
    await expect(auditEntries.first()).toBeVisible({ timeout: 10_000 });
  });
});
