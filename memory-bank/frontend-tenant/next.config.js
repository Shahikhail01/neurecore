/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // Ensure Next infers the repository root for output tracing
  outputFileTracingRoot: path.join(__dirname, ".."),
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // ── Compression & minification ─────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // ── Font & image optimisation ──────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // ── Bundle optimisation (tree-shake heavy libraries) ──────────────────────
  experimental: {
    optimizePackageImports: ["framer-motion", "zustand"],
  },

  // ── Webpack: exclude nocobase plugin sources from compilation ─────────────
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/src/plugins/**"],
    };
    return config;
  },

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Permissions-Policy", value: "microphone=self" },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
