/** @type {import('next').NextConfig} */
const path = require("path");
const isProd = process.env.NODE_ENV === "production";

// Set outputFileTracingRoot to the repository root to avoid Next.js inferring
// the wrong workspace root when multiple lockfiles exist in parent folders.
const nextConfig = {
  // Ensure Next infers the repository root for output tracing
  outputFileTracingRoot: path.join(__dirname, ".."),
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  ...(isProd
    ? {
        // In production we serve the admin portal behind /admin.
        // In local dev we keep routes unprefixed (e.g. /login) for simplicity.
        basePath: "/admin",
        assetPrefix: "/admin",
      }
    : {}),
};

module.exports = nextConfig;
