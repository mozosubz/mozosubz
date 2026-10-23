/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Bounty fix (INFO-1): baseline hardening headers. CSP ships report-only
  // first so violations can be triaged before enforcing.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          {
            key: "Content-Security-Policy-Report-Only",
            // Bachs overlay origins (bachs.js + its checkout iframe, live and
            // sandbox) must be listed before this can be enforced, otherwise
            // the deposit checkout breaks. frame-ancestors/base-uri/object-src/
            // form-action close the usual injection and clickjacking gaps.
            //
            // script-src must allow 'unsafe-inline': Next.js emits inline
            // hydration/bootstrap scripts, and without it every page load
            // reports a violation. A nonce is the only way to drop
            // 'unsafe-inline' here, which would force every route dynamic.
            value:
              [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://checkout.bachs.io https://sandbox-checkout.bachs.io https://*.vercel-analytics.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.bachs.io https://sandbox-api.bachs.io",
                "frame-src https://checkout.bachs.io https://sandbox-checkout.bachs.io",
                "frame-ancestors 'self'",
                "base-uri 'self'",
                "object-src 'none'",
                "form-action 'self'",
                "report-uri /api/csp-report",
              ].join("; "),
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      // Public API subdomain: api.mozosubz.xyz/v1/* → /api/mozosubz/v1/*
      // This is what the docs advertise as the base URL. Without this rewrite,
      // curl hits the Next.js homepage 404 because the route only exists under
      // /api/mozosubz/v1/*. Scoped to the api subdomain only — main domain
      // (mozosubz.xyz / www.mozosubz.xyz) keeps its existing routing.
      {
        source: "/v1/:path*",
        has: [{ type: "host", value: "api.mozosubz.xyz" }],
        destination: "/api/mozosubz/v1/:path*",
      },
    ]
  },
}

export default nextConfig
