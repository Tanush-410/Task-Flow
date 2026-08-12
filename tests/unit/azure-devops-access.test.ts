import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentDeploymentEnvironment: vi.fn(),
  evaluateFeatureFlag: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`REDIRECT:${location}`);
  }),
  requireAdmin: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('@/modules/operations/deployment-environment', () => ({
  currentDeploymentEnvironment: mocks.currentDeploymentEnvironment,
}));
vi.mock('@/modules/operations/feature-flags', () => ({
  evaluateFeatureFlag: mocks.evaluateFeatureFlag,
}));

import { requireAzureDevOpsAdmin } from '@/modules/azure-devops/connections/access';

const membership = {
  organizationId: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000002',
  role: 'admin' as const,
};

describe('requireAzureDevOpsAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(membership);
    mocks.currentDeploymentEnvironment.mockReturnValue('staging');
    mocks.evaluateFeatureFlag.mockResolvedValue(true);
  });

  it.each(['/login', '/my-day'])(
    'delegates base access failures from requireAdmin (%s)',
    async (location) => {
      mocks.requireAdmin.mockRejectedValue(new Error(`REDIRECT:${location}`));

      await expect(requireAzureDevOpsAdmin()).rejects.toThrow(
        `REDIRECT:${location}`,
      );

      expect(mocks.currentDeploymentEnvironment).not.toHaveBeenCalled();
      expect(mocks.evaluateFeatureFlag).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it('evaluates the integration flag with the exact verified membership scope', async () => {
    await expect(requireAzureDevOpsAdmin()).resolves.toEqual(membership);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
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

  it('redirects to settings when the integration flag is disabled', async () => {
    mocks.evaluateFeatureFlag.mockResolvedValue(false);

    await expect(requireAzureDevOpsAdmin()).rejects.toThrow(
      'REDIRECT:/settings',
    );

    expect(mocks.redirect).toHaveBeenCalledWith('/settings');
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

    await expect(requireAzureDevOpsAdmin()).rejects.toThrow(
      'REDIRECT:/settings',
    );
    expect(mocks.redirect).toHaveBeenCalledWith('/settings');
  });
});
