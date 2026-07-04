import type { NextConfig } from "next";

const isNativeStaticExport = process.env.NEXT_OUTPUT_MODE === "export";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(isNativeStaticExport
    ? {
        images: {
          unoptimized: true
        },
        output: "export" as const
      }
    : {}),
  poweredByHeader: false,
  productionBrowserSourceMaps: true
};

export default nextConfig;
