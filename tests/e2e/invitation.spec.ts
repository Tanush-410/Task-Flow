import { expect, test } from '@playwright/test';

test('invitation acceptance UI fails closed for an unknown bearer token', async ({
  page,
}) => {
  // Phase 0 exposes invitation acceptance, while invitation creation and its
  // deferred delivery adapter have no browser screen yet. Exercise the real
  // acceptance boundary and its deterministic failure result.
  const token = 'A'.repeat(43);

  await page.goto(`/invite/${token}`);
  await expect(
    page.getByRole('heading', { name: 'Organization invitation' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Sign in to continue' }).click();

  await page.getByLabel('Email').fill('admin@example.test');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(new RegExp(`/invite/${token}$`));
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page).toHaveURL(new RegExp(`/invite/${token}\\?error=invalid$`));
  await expect(
    page.getByRole('alert').filter({
      hasText: 'This invitation could not be accepted',
    }),
  ).toBeVisible();
});
