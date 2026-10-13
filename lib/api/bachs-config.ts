// Single configurable base URL for every Bachs call.
//
// Bachs publishes two official hosts: https://api.bachs.io (production) and
// https://sandbox-api.bachs.io (sandbox), so the base URL is env-configurable
// to point at the sandbox without a code change. Defaults to production.
//
// This lives in its own module rather than the "use server" action file because
// a "use server" file may only export async functions.
export const BACHS_BASE_URL = (process.env.BACHS_BASE_URL || 'https://api.bachs.io').replace(/\/$/, '')

// Bachs secret API key (sk_live_... / sk_sandbox_...).
//
// SERVER-ONLY: this key authorizes the Bachs API and signs webhooks, so it
// must never reach the browser. The overlay checkout needs no publishable key
// (there is no client-side Bachs key to configure) — the browser only ever
// receives the short-lived checkout_url returned by createBachsCheckoutSession.
export const BACHS_SECRET_KEY = process.env.BACHS_SECRET_KEY || ''

// True when the Bachs secret key is present, i.e. checkout sessions can be
// created and webhook signatures can be verified.
export function isBachsConfigured(): boolean {
  return BACHS_SECRET_KEY.trim().length > 0
}
