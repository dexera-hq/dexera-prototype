import type { NextConfig } from 'next';

const bffBaseUrl = process.env.DEXERA_BFF_BASE_URL?.trim();

if (!bffBaseUrl) {
  throw new Error('DEXERA_BFF_BASE_URL is required');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dexera/api-types', '@dexera/shared-types'],
  async rewrites() {
    return [
      {
        source: '/health',
        destination: `${bffBaseUrl}/health`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${bffBaseUrl}/api/v1/:path*`,
      },
    ];
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    return config;
  },
};

export default nextConfig;
