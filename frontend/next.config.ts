import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8088/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:8088/uploads/:path*',
      },
    ]
  },
};

export default nextConfig;
