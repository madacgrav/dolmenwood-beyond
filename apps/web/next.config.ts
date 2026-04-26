import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  // Use standalone output for Docker builds; skip locally on Windows where symlinks require elevated permissions
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  experimental: {},
  transpilePackages: ['@dolmenwood/ui', '@dolmenwood/rules-engine', '@dolmenwood/types'],
};

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
