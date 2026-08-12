import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { fixtureFetch } from '@/modules/azure-devops/testing/fixture-fetch';

const originalFlag = process.env.AZURE_DEVOPS_E2E_FIXTURES;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.AZURE_DEVOPS_E2E_FIXTURES;
  } else {
    process.env.AZURE_DEVOPS_E2E_FIXTURES = originalFlag;
  }
});

describe('fixtureFetch', () => {
  it('is disabled by default so real fetch is used', () => {
    delete process.env.AZURE_DEVOPS_E2E_FIXTURES;
    expect(fixtureFetch()).toBeUndefined();
  });

  it('stays disabled unless the flag is exactly "true"', () => {
    process.env.AZURE_DEVOPS_E2E_FIXTURES = 'false';
    expect(fixtureFetch()).toBeUndefined();

    process.env.AZURE_DEVOPS_E2E_FIXTURES = '1';
    expect(fixtureFetch()).toBeUndefined();
  });

  describe('when enabled', () => {
    beforeEach(() => {
      process.env.AZURE_DEVOPS_E2E_FIXTURES = 'true';
    });

    it('serves a canned Entra token response', async () => {
      const fetchFixture = fixtureFetch();
      expect(fetchFixture).toBeDefined();

      const response = await fetchFixture!(
        'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
        { method: 'POST' },
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: expect.any(Number),
        scope: expect.stringContaining('offline_access'),
      });
    });

    it('serves a canned profile response', async () => {
      const fetchFixture = fixtureFetch()!;
      const response = await fetchFixture(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
      );

      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        displayName: expect.any(String),
        emailAddress: expect.any(String),
      });
    });

    it('serves a canned accounts page', async () => {
      const fetchFixture = fixtureFetch()!;
      const response = await fetchFixture(
        'https://app.vssps.visualstudio.com/_apis/accounts?memberId=aaaaaaaa-0000-4000-8000-000000000004&api-version=7.1',
      );

      const body = await response.json();
      expect(body.value).toHaveLength(1);
      expect(body.value[0].accountUri).toMatch(
        /^https:\/\/vssps\.dev\.azure\.com\/[a-z0-9-]+\/$/,
      );
    });

    it('serves canned project and team pages', async () => {
      const fetchFixture = fixtureFetch()!;

      const projects = await fetchFixture(
        'https://dev.azure.com/contoso-fixture/_apis/projects?api-version=7.1',
      );
      const projectsBody = await projects.json();
      expect(projectsBody.value).toHaveLength(1);
      const projectId = projectsBody.value[0].id;

      const teams = await fetchFixture(
        `https://dev.azure.com/contoso-fixture/_apis/projects/${projectId}/teams?api-version=7.1`,
      );
      const teamsBody = await teams.json();
      expect(teamsBody.value).toHaveLength(1);
    });

    it('returns 404 for unrecognized fixture requests', async () => {
      const fetchFixture = fixtureFetch()!;
      const response = await fetchFixture('https://dev.azure.com/unknown');

      expect(response.status).toBe(404);
    });
  });
});
