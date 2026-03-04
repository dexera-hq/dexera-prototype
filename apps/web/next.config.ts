import type { NextConfig } from 'next';

const bffBaseUrl = process.env.DEXERA_BFF_BASE_URL?.trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dexera/api-types', '@dexera/shared-types'],
  async rewrites() {
    if (!bffBaseUrl) {
      return [];
    }

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
