import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep server async chunks next to webpack-runtime.js to avoid runtime lookup mismatch on Windows.
      config.output.chunkFilename = '[id].js';
    }

    return config;
  },
};

export default nextConfig;
