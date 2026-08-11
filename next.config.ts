import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Playwright intentionally uses the loopback IP for deterministic local
  // routing; Next dev otherwise blocks its client chunks as cross-origin.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
