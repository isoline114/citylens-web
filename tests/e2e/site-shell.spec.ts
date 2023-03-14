import { expect, test } from '@playwright/test';

test('shared shell exposes one landmark, active navigation, and a true sticky footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/pricing');

  await expect(page.getByRole('main')).toHaveCount(1);
  const pricingLinks = page.getByRole('link', { name: 'Pricing', exact: true });
  await expect(pricingLinks).toHaveCount(2);
  await expect(pricingLinks.first()).toHaveAttribute('aria-current', 'page');
  await expect(pricingLinks.last()).not.toHaveAttribute('aria-current');
  await expect(
    page.getByText(/demo mode \(precomputed\)/i),
  ).not.toBeVisible();

  const footerBounds = await page.locator('footer').boundingBox();
  expect(footerBounds).not.toBeNull();
  expect(
    Math.round((footerBounds?.y ?? 0) + (footerBounds?.height ?? 0)),
  ).toBeGreaterThanOrEqual(1000);

  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await page.goto('/');
  await expect(
    page
      .getByRole('navigation', {
        name: 'Primary navigation',
        exact: true,
      })
      .getByRole('link', { name: 'Home', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
