import { expect, test } from '@playwright/test';

import {
  expectNoDocumentHorizontalOverflow,
  expectNoWcagViolations,
} from './accessibility';

test('account entry routes share a concise, accessible workspace frame', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');

  await expect(page).toHaveTitle('Sign in — CityLens');
  await expect(page.getByTestId('auth-page-shell')).toBeVisible();
  await expect(
    page.getByText('Move from parcel signal to a defensible decision.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(1);
  await expect(page.getByText('Five-borough map')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page, 'mobile sign-in');
  await expectNoWcagViolations(page, 'mobile sign-in');

  await page.goto('/forgot-password');
  await expect(page).toHaveTitle('Reset password — CityLens');
  await expect(page.getByTestId('auth-page-shell')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page, 'mobile password recovery');
});

test('signed-out developer access stays account-gated and hides key instructions', async ({
  page,
}) => {
  await page.goto('/account/api-keys');

  await expect(page).toHaveTitle('API keys · CityLens');
  await expect(page.getByTestId('product-page-header')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sign in to manage API keys' }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: /^Sign in$/ }),
  ).toHaveAttribute('href', '/sign-in?next=%2Faccount%2Fapi-keys');
  await expect(page.getByText('Verify a key')).not.toBeVisible();
  await expectNoDocumentHorizontalOverflow(page, 'signed-out API keys');
  await expectNoWcagViolations(page, 'signed-out API keys');
});
