import type { NextConfig } from "next";

const localApiProxyUrl = (process.env.LOCAL_API_PROXY_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: {
    cpus: 1,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    serverSourceMaps: false,
    staticGenerationMaxConcurrency: 1,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        has: [
          {
            type: "host",
            value: "(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?",
          },
        ],
        destination: `${localApiProxyUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
