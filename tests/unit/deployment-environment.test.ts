import { describe, expect, it } from 'vitest';

import { resolveDeploymentEnvironment } from '@/modules/operations/deployment-environment';

describe('deployment environment selection', () => {
  it('uses development outside a deployment', () => {
    expect(resolveDeploymentEnvironment({ nodeEnv: 'development' })).toBe(
      'development',
    );
  });

  it('maps Vercel previews to staging', () => {
    expect(
      resolveDeploymentEnvironment({
        nodeEnv: 'production',
        vercelEnv: 'preview',
      }),
    ).toBe('staging');
  });

  it('maps production deployments to production', () => {
    expect(
      resolveDeploymentEnvironment({
        nodeEnv: 'production',
        vercelEnv: 'production',
      }),
    ).toBe('production');
  });
});
