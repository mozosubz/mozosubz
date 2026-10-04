/**
 * Cloudflare Worker: Monnify API proxy for Vercel deployments.
 *
 * Cloudflare's WAF on api.monnify.com blocks Vercel's serverless egress IP
 * ranges (403 "Sorry, you have been blocked" on init-transaction). Deploying
 * this worker gives MozoSubz a different egress IP: requests go
 * Vercel -> this Worker (Cloudflare edge) -> api.monnify.com.
 *
 * Deploy (free plan is enough):
 *   1. Install wrangler:  npm install -g wrangler
 *   2. Login:             wrangler login
 *   3. From this folder:  wrangler deploy
 *   4. Note the worker URL, e.g. https://monnify-proxy.<your-subdomain>.workers.dev
 *   5. In Vercel project settings, add env var:
 *        MONNIFY_PROXY_URL = https://monnify-proxy.<your-subdomain>.workers.dev
 *   6. Redeploy the app.
 *
 * Security notes:
 *   - No credentials live in the worker; it only forwards paths under /api/.
 *   - Only same-method pass-through: the app's Authorization header (its own
 *     Monnify credentials) is forwarded untouched.
 */

const UPSTREAM = 'https://api.monnify.com'

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url)

    // Only allow the API paths the app actually uses.
    if (!incoming.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const upstreamUrl = UPSTREAM + incoming.pathname + incoming.search

    const headers = new Headers(request.headers)
    headers.set('Host', 'api.monnify.com')
    // Let Monnify's Cloudflare see a normal client fingerprint.
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    )

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
    })

    return fetch(upstreamRequest)
  },
}
