import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // IMPORTANT: must match the canonical host used in layout.tsx metadataBase,
  // robots.ts, OG tags, and JSON-LD. Mismatched hosts split ranking signals.
  const baseUrl = 'https://mozosubz.xyz'
  const lastModified = new Date()

  return [
    { url: baseUrl,                       lastModified, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/about`,            lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/services`,         lastModified, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/doc`,              lastModified, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${baseUrl}/login`,            lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/register`,         lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/forgot-password`,  lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`,          lastModified, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${baseUrl}/terms`,            lastModified, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${baseUrl}/unsubscribe`,      lastModified, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
