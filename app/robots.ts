import { MetadataRoute } from 'next'

// Canonical host MUST match layout.tsx metadataBase, sitemap.ts, OG tags,
// and JSON-LD. Mismatched hosts split Google ranking signals across two
// "preferred" URLs. We standardize on https://mozosubz.xyz (no www).
const HOST = 'https://mozosubz.xyz'

const PUBLIC_ALLOW = [
  '/',
  '/about',
  '/services',
  '/doc',
  '/login',
  '/register',
  '/forgot-password',
  '/privacy',
  '/terms',
  '/unsubscribe',
]

const PRIVATE_DISALLOW = [
  '/admin',
  '/admin/',
  '/api/',
  '/dashboard',
  '/dashboard/',
  '/integrations',
  '/integrations/',
  '/checkout',
  '/checkout/',
  '/confirm-email',
  '/reset-password',
  '/register-success',
  '/profile',
  '/profile/',
  '/*.json$',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'Googlebot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
        crawlDelay: 0,
      },
      {
        userAgent: 'Bingbot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
        crawlDelay: 0,
      },
      {
        userAgent: 'DuckDuckBot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'YandexBot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'Baiduspider',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
        crawlDelay: 1,
      },
    ],
    sitemap: `${HOST}/sitemap.xml`,
    host: HOST,
  }
}
