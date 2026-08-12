import 'server-only';

const TOKEN_PATH_SUFFIX = '/oauth2/v2.0/token';
const PROFILE_PATH = '/_apis/profile/profiles/me';
const ACCOUNTS_PATH = '/_apis/accounts';
const PROJECTS_PATH_SUFFIX = '/_apis/projects';
const TEAMS_PATH_SUFFIX = '/teams';

const FIXTURE_ACCOUNT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const FIXTURE_PROJECT_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
const FIXTURE_TEAM_ID = 'aaaaaaaa-0000-4000-8000-000000000003';
const FIXTURE_PROFILE_ID = 'aaaaaaaa-0000-4000-8000-000000000004';
const FIXTURE_ORGANIZATION_SLUG = 'contoso-fixture';

/**
 * The connect/callback boundary and Azure discovery calls happen inside the
 * Next.js server process, outside the browser network Playwright can
 * intercept. This module swaps in canned responses for those two hosts so
 * e2e can exercise the real callback/discovery/mapping code paths without
 * reaching Microsoft. It is only ever consulted when the deploying
 * environment explicitly opts in; every other environment gets `undefined`
 * and callers fall back to the platform `fetch`. `NODE_ENV`/deployment
 * environment cannot gate this because CI's e2e run boots the app with
 * `next start` (a production build) to match what ships.
 */
function fixturesEnabled(): boolean {
  return process.env.AZURE_DEVOPS_E2E_FIXTURES === 'true';
}

function jsonResponse(body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function notFoundResponse(): Response {
  return new Response(JSON.stringify({ message: 'fixture route not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokenResponse(): Response {
  return jsonResponse({
    access_token: 'fixture-access-token',
    refresh_token: 'fixture-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
  });
}

function profileResponse(): Response {
  return jsonResponse({
    id: FIXTURE_PROFILE_ID,
    displayName: 'Fixture Azure User',
    emailAddress: 'fixture.azure@example.test',
  });
}

function accountsResponse(): Response {
  return jsonResponse({
    count: 1,
    value: [
      {
        accountId: FIXTURE_ACCOUNT_ID,
        accountName: FIXTURE_ORGANIZATION_SLUG,
        accountUri: `https://vssps.dev.azure.com/${FIXTURE_ORGANIZATION_SLUG}/`,
      },
    ],
  });
}

function projectsResponse(): Response {
  return jsonResponse({
    count: 1,
    value: [{ id: FIXTURE_PROJECT_ID, name: 'Fixture Project' }],
  });
}

function teamsResponse(): Response {
  return jsonResponse({
    count: 1,
    value: [{ id: FIXTURE_TEAM_ID, name: 'Fixture Team' }],
  });
}

function respond(url: URL, method: string): Response {
  if (
    url.hostname === 'login.microsoftonline.com' &&
    method === 'POST' &&
    url.pathname.endsWith(TOKEN_PATH_SUFFIX)
  ) {
    return tokenResponse();
  }

  if (
    url.hostname === 'app.vssps.visualstudio.com' &&
    method === 'GET' &&
    url.pathname === PROFILE_PATH
  ) {
    return profileResponse();
  }

  if (
    url.hostname === 'app.vssps.visualstudio.com' &&
    method === 'GET' &&
    url.pathname === ACCOUNTS_PATH
  ) {
    return accountsResponse();
  }

  if (
    url.hostname === 'dev.azure.com' &&
    method === 'GET' &&
    url.pathname.endsWith(TEAMS_PATH_SUFFIX)
  ) {
    return teamsResponse();
  }

  if (
    url.hostname === 'dev.azure.com' &&
    method === 'GET' &&
    url.pathname.endsWith(PROJECTS_PATH_SUFFIX)
  ) {
    return projectsResponse();
  }

  return notFoundResponse();
}

/**
 * Returns a `fetch`-compatible function serving canned Entra/Azure DevOps
 * responses when e2e fixtures are enabled, otherwise `undefined` so callers
 * use the real platform fetch.
 */
export function fixtureFetch(): typeof fetch | undefined {
  if (!fixturesEnabled()) return undefined;

  return async function fetchFixture(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = init?.method ?? 'GET';
    return respond(url, method);
  };
}
