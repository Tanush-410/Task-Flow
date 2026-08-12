import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Leaves the Azure DevOps connection disconnected so the flow below starts
 * clean whether this spec is running against a freshly reset database (CI)
 * or a developer's already-seeded local Supabase from a prior run.
 */
async function ensureDisconnected(page: Page) {
  await page.goto('/settings/integrations/azure-devops');
  const disconnect = page.getByRole('button', { name: 'Disconnect' });
  if (await disconnect.isVisible().catch(() => false)) {
    await disconnect.click();
    await page.getByRole('button', { name: 'Confirm disconnect' }).click();
    await expect(page.getByText('Not connected')).toBeVisible();
  }
}

test('employee cannot open the Azure DevOps settings route', async ({
  page,
}) => {
  await signIn(page, 'employee@example.test');

  await page.goto('/settings/integrations/azure-devops');

  await expect(page).not.toHaveURL(/\/settings\/integrations\/azure-devops$/);
  await expect(page.getByRole('heading', { name: 'Azure DevOps' })).toHaveCount(
    0,
  );
});

test('admin connects, maps a planning team, and disconnects while preserving it', async ({
  page,
  context,
}) => {
  const teamName = `Delivery ${Date.now()}`;

  await signIn(page, 'admin@example.test');

  await page.goto('/settings');
  await expect(
    page.getByRole('link', { name: 'Manage Azure DevOps' }),
  ).toBeVisible();

  await page.goto('/planning/teams');
  await page.getByRole('textbox', { name: 'Team name' }).fill(teamName);
  await page
    .getByRole('textbox', { name: 'Description' })
    .fill('Owns delivery for the connection acceptance test');
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();

  await ensureDisconnected(page);

  // The connect/callback code exchange and Azure discovery calls happen
  // inside the Next.js server process, not the browser, so they are served
  // by the fixture fetch (AZURE_DEVOPS_E2E_FIXTURES=true, see
  // playwright.config.ts) instead of reaching Microsoft. The only hop this
  // spec needs to intercept in the browser is the redirect *to* Microsoft:
  // send the browser straight back to our own callback with the real,
  // server-issued state and a fixture authorization code.
  await context.route('https://login.microsoftonline.com/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const state = requestUrl.searchParams.get('state') ?? '';
    const callbackUrl = new URL(
      '/api/integrations/azure-devops/callback',
      page.url(),
    );
    callbackUrl.searchParams.set('code', 'fixture-authorization-code');
    callbackUrl.searchParams.set('state', state);

    await route.fulfill({
      status: 303,
      headers: { Location: callbackUrl.toString() },
    });
  });

  await page.getByRole('button', { name: 'Connect Azure DevOps' }).click();
  await expect(page.getByText('Pending setup')).toBeVisible();
  await expect(page.getByText('Fixture Azure User')).toBeVisible();

  await expect(page.getByLabel('Azure DevOps organization')).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Azure DevOps organization' })
    .click();
  await page.getByRole('option', { name: 'contoso-fixture' }).click();
  await page.getByRole('button', { name: 'Use this organization' }).click();
  await expect(page.getByText('contoso-fixture')).toBeVisible();

  await page.getByRole('combobox', { name: 'Azure project' }).click();
  await page.getByRole('option', { name: 'Fixture Project' }).click();
  await page.getByRole('combobox', { name: 'Azure team' }).click();
  await page.getByRole('option', { name: 'Fixture Team' }).click();
  await page.getByRole('combobox', { name: 'TaskFlow planning team' }).click();
  await page.getByRole('option', { name: teamName }).click();
  await page.getByRole('button', { name: 'Map planning team' }).click();

  await expect(page.getByText('Ready for initial import')).toHaveCount(2);
  await expect(page.getByText('Fixture Project / Fixture Team')).toBeVisible();

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(
    page.getByText(/Planning teams and their mappings are preserved/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm disconnect' }).click();
  await expect(page.getByText('Not connected')).toBeVisible();

  await page.goto('/planning/teams');
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
});
