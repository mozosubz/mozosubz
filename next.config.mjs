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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.supabase.in; report-uri /api/csp-report",
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
