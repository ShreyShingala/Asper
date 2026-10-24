import type { NextConfig } from "next";

const API = process.env.MOLDFLOW_API ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next", // e2e uses its own build dir so it never clobbers a running `next start`
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com", "**.ngrok-free.app", "192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
