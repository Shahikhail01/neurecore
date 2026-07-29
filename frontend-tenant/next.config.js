/** @type {import('next').NextConfig} */
const nextConfig = {
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

  // ── Phase 2 — Route rewrites for backward-compatible migration ────────────
  //
  // Old flat routes are mapped to new canonical URLs so tenants never see
  // intentional 404s. After 30 days of zero direct traffic (tracked via
  // observability), old routes are removed in a later minor release.
  //
  // See memory-bank/new_neurecore.md §4.1 for full migration plan.
  async rewrites() {
    const backend = process.env.NEXT_INTERNAL_API_URL || 'http://127.0.0.1:3003';
    return [
      // Cookie-only auth (F1 + Batch 1 hardening): proxy /api/v1/* to the
      // NestJS backend through Next.js so the browser sees same-origin
      // requests and no CORS preflight is needed. `__Host-` cookies work
      // because the backend sits in the same TLS host; cookies carry
      // Secure + no Domain attributes as required by the prefix.
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },

      // Phase 5.5 — Tenant home (Creatio-style) is the default landing page.
      // /dashboard and /command-center survive as legacy aliases so pinned
      // links still resolve.
      { source: "/dashboard", destination: "/home" },
      { source: "/command-center", destination: "/home" },

      // Marketplace (covers agent listing + connector config)
      { source: "/agents", destination: "/marketplace?tab=agents" },
      { source: "/agents/new", destination: "/marketplace?tab=spawn" },
      { source: "/connectors", destination: "/marketplace?tab=connectors" },

      // Departments roster + org chart
      { source: "/departments", destination: "/departments" }, // canonical
      { source: "/org-chart", destination: "/departments?tab=org-chart" },

      // Per-dept workspace redirects (Phase 5 ships these; placeholder for now)
      // Tenant sees first dept's workspace if /tasks etc. hit without context.
      { source: "/tasks", destination: "/departments?tab=tasks" },
      { source: "/workflows", destination: "/departments?tab=workflows" },
      // /projects is now a canonical AWL route and must not be masked by
      // the department workspace compatibility rewrite.
      { source: "/goals", destination: "/departments?tab=goals" },
      { source: "/routines", destination: "/departments?tab=routines" },

      // Finance hub
      { source: "/costs", destination: "/finance?tab=overview" },
      { source: "/billing", destination: "/finance?tab=billing" },

      // Service desk
      { source: "/inbox", destination: "/service-desk?tab=inbox" },
      { source: "/approvals", destination: "/service-desk?tab=approvals" },
      { source: "/activity", destination: "/service-desk?tab=activity" },

      // Intelligence
      { source: "/analytics", destination: "/intelligence?tab=analytics" },

      // Strategy page deleted
      { source: "/strategy", destination: "/home" },
    ];
  },
};

module.exports = nextConfig;
