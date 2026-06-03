import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/icon-192.png', destination: '/icon.png', permanent: false },
      { source: '/icon-512.png', destination: '/icon.png', permanent: false },
      { source: '/apple-icon.png', destination: '/icon.png', permanent: false },
    ]
  },
};

export default nextConfig;
