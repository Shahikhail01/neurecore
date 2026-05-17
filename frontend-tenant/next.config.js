/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ── Compression & minification ─────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // ── Font & image optimisation ──────────────────────────────────────────────
  optimizeFonts: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // ── Bundle optimisation (tree-shake heavy libraries) ──────────────────────
  experimental: {
    optimizePackageImports: ['framer-motion', 'zustand'],
  },

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff'          },
          { key: 'X-Frame-Options',            value: 'DENY'             },
          { key: 'X-XSS-Protection',           value: '1; mode=block'    },
          { key: 'Referrer-Policy',            value: 'strict-origin'    },
          { key: 'Permissions-Policy',         value: 'microphone=self'  },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
