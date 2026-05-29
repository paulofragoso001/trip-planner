import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  productionBrowserSourceMaps: true
};

export default nextConfig;
