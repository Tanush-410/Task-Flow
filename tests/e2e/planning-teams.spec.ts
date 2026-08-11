import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('admin configures a planning team that its member can access', async ({
  page,
  context,
}) => {
  const teamName = `Platform ${Date.now()}`;

  await signIn(page, 'admin@example.test');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();
  await page.getByRole('link', { name: 'Planning' }).click();
  await page.getByRole('link', { name: 'Manage teams' }).click();

  await page.getByRole('textbox', { name: 'Team name' }).fill(teamName);
  await page
    .getByRole('textbox', { name: 'Description' })
    .fill('Owns core delivery');
  await page.getByRole('button', { name: 'Create team' }).click();

  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include Eshan Employee' }).click();
  await page.getByRole('button', { name: 'Save members' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save members' }),
  ).toBeVisible();

  await page.getByRole('spinbutton', { name: 'Sprint length' }).fill('21');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Sprint length' }),
  ).toHaveValue('21');

  await context.clearCookies();
  await signIn(page, 'employee@example.test');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();
  await page.getByRole('link', { name: 'Planning' }).click();
  await page.getByRole('link', { name: new RegExp(teamName) }).click();

  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
  await expect(page.getByText('Your capacity')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive team' })).toHaveCount(
    0,
  );
  await expect(page.getByText('Team settings')).toHaveCount(0);
});
