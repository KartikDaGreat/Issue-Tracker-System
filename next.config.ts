import type { NextConfig } from "next";

/**
 * A Content-Security-Policy that the app can actually satisfy.
 *
 * Next.js injects inline bootstrap scripts and styles, so 'unsafe-inline' is
 * required for those; 'unsafe-eval' is limited to development, where React
 * Refresh needs it. Everything else is locked to same-origin.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // blob: covers the in-browser PDF preview of the inventory report.
  "object-src 'none'",
  "frame-src 'self' blob:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
