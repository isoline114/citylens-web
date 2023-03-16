import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  expectNoWcagViolations,
} from './accessibility';

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

  for (const policy of [
    {
      path: '/privacy',
      title: 'Privacy notice',
      navigation: 'Privacy notice sections',
    },
    {
      path: '/terms',
      title: 'Pilot terms of use',
      navigation: 'Pilot terms of use sections',
    },
  ]) {
    await page.goto(policy.path);
    await expect(
      page.getByRole('heading', { level: 1, name: policy.title }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: policy.navigation }),
    ).toBeVisible();
    await expect(page.getByTestId('legal-document-shell')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /hello@citylens.dev/i }).last(),
    ).toHaveAttribute('href', 'mailto:hello@citylens.dev');
    await expectNoWcagViolations(page, policy.title);
  }

  await page.goto('/docs');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build acquisition workflows on a source-aware city model.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Developer center sections' }),
  ).toBeVisible();
  await expect(page.getByTestId('developer-center-hero')).toBeVisible();
  await expect(
    page.getByText(/authenticated_full/),
  ).toBeVisible();
  await expectNoWcagViolations(page, 'Developer center');

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/privacy');
  await expectNoDocumentHorizontalOverflow(
    page,
    'Privacy notice at 400% equivalent zoom',
  );
  await page.goto('/docs');
  await expectNoDocumentHorizontalOverflow(
    page,
    'Developer center at 400% equivalent zoom',
  );
});
