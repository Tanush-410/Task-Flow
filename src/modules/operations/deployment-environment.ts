import type { Database } from '@/lib/supabase/database.types';

type Environment = Database['public']['Enums']['deployment_environment'];

export function resolveDeploymentEnvironment(input: {
  nodeEnv?: string;
  vercelEnv?: string;
}): Environment {
  if (input.vercelEnv === 'preview') return 'staging';
  if (input.vercelEnv === 'production' || input.nodeEnv === 'production') {
    return 'production';
  }
  return 'development';
}

export function currentDeploymentEnvironment(): Environment {
  return resolveDeploymentEnvironment({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
