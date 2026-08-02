import { expect, test } from '@playwright/test';

test('employee receives employee navigation and cannot open the admin dashboard', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('employee@example.test');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/my-day$/);
  await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My Tasks' })).toBeVisible();

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/my-day$/);
});
