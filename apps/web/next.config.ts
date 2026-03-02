import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dexera/api-types', '@dexera/shared-types'],
};

export default nextConfig;
