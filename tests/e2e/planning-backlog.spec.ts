import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function createTeam(page: Page, name: string): Promise<string> {
  await page.goto('/planning/teams');
  await page.getByRole('textbox', { name: 'Team name' }).fill(name);
  await page.getByRole('button', { name: 'Create team' }).click();
  await page.waitForURL(/\/planning\/teams\/[0-9a-f-]+$/);
  return page.url().split('/').pop()!;
}

async function openBacklog(page: Page, teamId: string) {
  await page.goto(`/planning/teams/${teamId}/backlog`);
}

async function createWorkItem(
  page: Page,
  options: { via: 'new-epic' } | { via: 'add-child'; underTitle: string },
  title: string,
  storyPoints?: string,
) {
  if (options.via === 'new-epic') {
    await page.getByRole('button', { name: 'New epic' }).click();
  } else {
    await page
      .getByRole('button', {
        name: new RegExp(`^Add .* under ${options.underTitle}$`),
      })
      .click();
  }
  await page.getByLabel('Title').fill(title);
  if (storyPoints) {
    await page.getByLabel('Story points').fill(storyPoints);
  }
  await page.getByRole('button', { name: /^Create /i }).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();
}

test('build a hierarchy, estimate, reorder, move within and across teams, and prove an outside member cannot see it', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const teamAName = `Backlog Team A ${stamp}`;
  const teamBName = `Backlog Team B ${stamp}`;
  const epicAlpha = `Epic Alpha ${stamp}`;
  const epicBeta = `Epic Beta ${stamp}`;
  const featureOne = `Feature One ${stamp}`;

  await signIn(page, 'admin@example.test');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();

  const teamAId = await createTeam(page, teamAName);
  await openBacklog(page, teamAId);

  // Build a hierarchy: two root epics, one estimated with story points.
  await createWorkItem(page, { via: 'new-epic' }, epicAlpha, '5');
  await createWorkItem(page, { via: 'new-epic' }, epicBeta);

  // Reorder: Alpha was created first (ranked first); moving it down
  // should swap the two root epics.
  let rootEpics = page.getByRole('link', { name: /^Epic (Alpha|Beta)/ });
  await expect(rootEpics.first()).toHaveText(epicAlpha);
  await page
    .getByRole('button', { name: `Move ${epicAlpha} down`, exact: true })
    .click();
  await expect(page.getByText('5 pts')).toBeVisible();
  rootEpics = page.getByRole('link', { name: /^Epic (Alpha|Beta)/ });
  await expect(rootEpics.first()).toHaveText(epicBeta);
  await expect(rootEpics.last()).toHaveText(epicAlpha);

  // Add a child feature under Epic Beta and estimate it inline.
  await createWorkItem(
    page,
    { via: 'add-child', underTitle: epicBeta },
    featureOne,
  );
  const featureRow = page
    .getByRole('link', { name: featureOne })
    .locator('xpath=..');
  await featureRow.getByRole('button', { name: '+ Estimate' }).click();
  await page.getByRole('spinbutton', { name: 'Story points' }).fill('8');
  await page.getByRole('button', { name: 'Save estimate' }).click();
  await expect(page.getByText('8 pts')).toBeVisible();

  // Same-team reparent: move Feature One from Epic Beta to Epic Alpha.
  // No descendant gate applies regardless of team, but this proves the
  // same-team path never even shows the checkbox.
  await page
    .getByRole('button', { name: `Move ${featureOne}`, exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: new RegExp(`Move .${featureOne}.`) }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'New parent' }).click();
  await page.getByRole('option', { name: new RegExp(`^${epicAlpha}`) }).click();
  await expect(page.getByText(/descendant/)).not.toBeVisible();
  await page.getByRole('button', { name: 'Move' }).click();
  await expect(page.getByText('Feature moved')).toBeVisible();

  // Epic Alpha now has the descendant; confirm it moved under Alpha by
  // collapsing Beta (now childless) and expanding Alpha.
  await expect(
    page.getByRole('button', { name: `Collapse ${epicAlpha}` }),
  ).toBeVisible();

  const teamBId = await createTeam(page, teamBName);
  await openBacklog(page, teamAId);

  // Cross-team move WITH a descendant: Epic Alpha now carries Feature
  // One, so moving it to Team B must require the checkbox.
  await page
    .getByRole('button', { name: `Move ${epicAlpha}`, exact: true })
    .click();
  await page.getByRole('combobox', { name: 'New team' }).click();
  await page.getByRole('option', { name: teamBName }).click();
  await expect(page.getByText(/1 descendant, which will move/)).toBeVisible();
  const moveAlphaButton = page.getByRole('button', { name: 'Move' });
  await expect(moveAlphaButton).toBeDisabled();
  await page.getByRole('checkbox', { name: /Move 1 descendant too/ }).click();
  await moveAlphaButton.click();
  await expect(page.getByText('Epic moved')).toBeVisible();

  await expect(page.getByRole('link', { name: epicBeta })).toBeVisible();
  await expect(page.getByRole('link', { name: epicAlpha })).not.toBeVisible();

  // Cross-team move WITHOUT descendants: Epic Beta is now childless, so
  // the same cross-team move must not require (or even show) the
  // checkbox.
  await page
    .getByRole('button', { name: `Move ${epicBeta}`, exact: true })
    .click();
  await page.getByRole('combobox', { name: 'New team' }).click();
  await page.getByRole('option', { name: teamBName }).click();
  await expect(page.getByText(/descendant/)).not.toBeVisible();
  const moveBetaButton = page.getByRole('button', { name: 'Move' });
  await expect(moveBetaButton).toBeEnabled();
  await moveBetaButton.click();
  await expect(page.getByText('Epic moved')).toBeVisible();

  await expect(
    page.getByText('No work items match these filters'),
  ).toBeVisible();

  await openBacklog(page, teamBId);
  await expect(page.getByRole('link', { name: epicAlpha })).toBeVisible();
  await expect(page.getByRole('link', { name: epicBeta })).toBeVisible();
  await expect(page.getByRole('link', { name: featureOne })).toBeVisible();

  // Visibility proof: an org member who was never added to Team B must
  // not see its work items, even though the route itself is reachable.
  await context.clearCookies();
  await signIn(page, 'employee@example.test');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();

  await openBacklog(page, teamBId);
  await expect(page.getByRole('link', { name: epicAlpha })).not.toBeVisible();
  await expect(page.getByRole('link', { name: epicBeta })).not.toBeVisible();
  await expect(page.getByRole('link', { name: featureOne })).not.toBeVisible();
});

test('file a bug under a feature, add a task under it, edit its details, and see them on the task page', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const teamName = `Bug Team ${stamp}`;
  const epicTitle = `Bug Epic ${stamp}`;
  const featureTitle = `Bug Feature ${stamp}`;
  const bugTitle = `Save crash ${stamp}`;
  const taskTitle = `Bug Task ${stamp}`;

  await signIn(page, 'admin@example.test');
  await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();

  const teamId = await createTeam(page, teamName);
  await openBacklog(page, teamId);

  await createWorkItem(page, { via: 'new-epic' }, epicTitle);
  await createWorkItem(
    page,
    { via: 'add-child', underTitle: epicTitle },
    featureTitle,
  );

  // A feature has two legal child types, so filing a bug goes through the
  // two-option menu instead of a single fixed-type button.
  await page
    .getByRole('button', { name: `Add work item under ${featureTitle}` })
    .click();
  await page.getByRole('menuitem', { name: 'Add bug' }).click();
  await expect(page.getByRole('heading', { name: 'New bug' })).toBeVisible();
  await page.getByLabel('Title').fill(bugTitle);
  await page.getByLabel('Repro steps').fill('Click Save on an empty form');
  await page.getByLabel('Found in build').fill('1.4.0');
  await page.getByRole('button', { name: 'Create bug' }).click();
  await expect(page.getByRole('link', { name: bugTitle })).toBeVisible();

  const bugRow = page.getByRole('link', { name: bugTitle }).locator('xpath=..');
  await expect(bugRow.getByText('Bug')).toBeVisible();

  // A bug's only legal child is a task, so it keeps the single-button flow
  // every other non-feature row uses.
  await createWorkItem(
    page,
    { via: 'add-child', underTitle: bugTitle },
    taskTitle,
  );

  // Edit bug details post-creation.
  await page
    .getByRole('button', { name: `Edit bug details for ${bugTitle}` })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Bug details' }),
  ).toBeVisible();
  await expect(page.getByLabel('Repro steps')).toHaveValue(
    'Click Save on an empty form',
  );
  await page
    .getByLabel('Repro steps')
    .fill('Click Save on an empty form, then refresh');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Bug details updated')).toBeVisible();

  // The task detail page shows the same bug details, read-only.
  await page.getByRole('link', { name: bugTitle }).click();
  await expect(page.getByRole('heading', { name: bugTitle })).toBeVisible();
  await expect(page.getByText('Bug details', { exact: true })).toBeVisible();
  await expect(page.getByText('Found in build 1.4.0')).toBeVisible();
  await expect(
    page.getByText('Click Save on an empty form, then refresh'),
  ).toBeVisible();
});
