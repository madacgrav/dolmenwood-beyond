import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Enable if needed for package transpilation
  },
  transpilePackages: ['@dolmenwood/ui', '@dolmenwood/rules-engine', '@dolmenwood/types'],
};

export default nextConfig;
