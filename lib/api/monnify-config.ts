// Single configurable base URL for every Monnify call.
//
// Monnify publishes exactly two official hosts: https://api.monnify.com
// (production) and https://sandbox.monnify.com (sandbox) — there is no third
// production hostname. Because Cloudflare blocks Vercel's egress IPs on the
// production host, the base URL is env-configurable so it can be pointed at a
// proxy/gateway without a code change. Defaults to production.
//
// This lives in its own module rather than the "use server" action file because
// a "use server" file may only export async functions.
export const MONNIFY_BASE_URL = (process.env.MONNIFY_BASE_URL || 'https://api.monnify.com').replace(/\/$/, '')
