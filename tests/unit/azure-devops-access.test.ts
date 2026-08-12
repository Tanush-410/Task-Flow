import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentDeploymentEnvironment: vi.fn(),
  evaluateFeatureFlag: vi.fn(),
  getMembershipAccess: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`REDIRECT:${location}`);
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/modules/members/queries', () => ({
  getMembershipAccess: mocks.getMembershipAccess,
}));
vi.mock('@/modules/operations/deployment-environment', () => ({
  currentDeploymentEnvironment: mocks.currentDeploymentEnvironment,
}));
vi.mock('@/modules/operations/feature-flags', () => ({
  evaluateFeatureFlag: mocks.evaluateFeatureFlag,
}));

import {
  getAzureDevOpsAdminAccess,
  requireAzureDevOpsAdmin,
} from '@/modules/azure-devops/connections/access';

const membership = {
  organizationId: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000002',
  role: 'admin' as const,
};

describe('Azure DevOps admin access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'membership',
      membership,
    });
    mocks.currentDeploymentEnvironment.mockReturnValue('staging');
    mocks.evaluateFeatureFlag.mockResolvedValue(true);
  });

  it.each(['/login', '/access-pending'] as const)(
    'preserves the membership redirect result %s without evaluating the flag',
    async (location) => {
      mocks.getMembershipAccess.mockResolvedValue({
        kind: 'redirect',
        location,
      });

      await expect(getAzureDevOpsAdminAccess()).resolves.toEqual({
        kind: 'redirect',
        location,
      });

      expect(mocks.currentDeploymentEnvironment).not.toHaveBeenCalled();
      expect(mocks.evaluateFeatureFlag).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it('redirects employees to my-day without evaluating the flag', async () => {
    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'membership',
      membership: { ...membership, role: 'employee' },
    });

    await expect(getAzureDevOpsAdminAccess()).resolves.toEqual({
      kind: 'redirect',
      location: '/my-day',
    });

    expect(mocks.currentDeploymentEnvironment).not.toHaveBeenCalled();
    expect(mocks.evaluateFeatureFlag).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('evaluates the integration flag with the exact verified admin scope', async () => {
    await expect(getAzureDevOpsAdminAccess()).resolves.toEqual({
      kind: 'allowed',
      membership,
    });

    expect(mocks.getMembershipAccess).toHaveBeenCalledOnce();
    expect(mocks.currentDeploymentEnvironment).toHaveBeenCalledOnce();
    expect(mocks.evaluateFeatureFlag).toHaveBeenCalledWith({
      key: 'azure_devops_integration',
      environment: 'staging',
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('returns a settings redirect when the integration flag is disabled', async () => {
    mocks.evaluateFeatureFlag.mockResolvedValue(false);

    await expect(getAzureDevOpsAdminAccess()).resolves.toEqual({
      kind: 'redirect',
      location: '/settings',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ['environment resolution', 'environment'],
    ['flag evaluation', 'flag'],
  ])('fails closed when %s throws', async (_label, failure) => {
    if (failure === 'environment') {
      mocks.currentDeploymentEnvironment.mockImplementation(() => {
        throw new Error('environment details');
      });
    } else {
      mocks.evaluateFeatureFlag.mockRejectedValue(
        new Error('feature flag details'),
      );
    }

    await expect(getAzureDevOpsAdminAccess()).resolves.toEqual({
      kind: 'redirect',
      location: '/settings',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('keeps the throwing require wrapper for page and action consumers', async () => {
    await expect(requireAzureDevOpsAdmin()).resolves.toEqual(membership);

    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'redirect',
      location: '/login',
    });
    await expect(requireAzureDevOpsAdmin()).rejects.toThrow('REDIRECT:/login');
    expect(mocks.redirect).toHaveBeenCalledWith('/login');
  });
});
