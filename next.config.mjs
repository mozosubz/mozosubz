/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
