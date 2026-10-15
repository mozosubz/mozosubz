/**
 * Admin identity is configuration, not code.
 *
 * Set `ADMIN_EMAILS` in the environment — comma-separated, e.g.
 *   ADMIN_EMAILS=admin@mozosubz.xyz,second@example.com
 *
 * The value is read at request time. IMPORTANT: on Vercel, middleware
 * (proxy.ts) runs on the edge runtime where env vars are bound into the
 * deployment — after changing ADMIN_EMAILS you MUST trigger a new deployment,
 * or the change will look like it "didn't work".
 *
 * Fallback: when ADMIN_EMAILS is unset, the historical addresses below keep
 * working, so a missing variable can never lock the owner out. Setting
 * ADMIN_EMAILS replaces the fallback entirely — remove an address there and it
 * stops being a hardcoded admin (an account's profiles.is_admin flag still
 * governs admin access on its own, independently of this list).
 *
 * Server/edge only: this reads a non-public env var, which is never inlined
 * into the browser bundle — do not call it from a client component. Current
 * callers are proxy.ts, server actions, server components and API routes.
 */
const FALLBACK_ADMIN_EMAILS = [
  'admin@mozosubz.xyz',
  'alfredjames0852@gmail.com',
]

function adminEmails(): string[] {
  const raw = (process.env.ADMIN_EMAILS || '').trim()
  const source = raw ? raw.split(',') : FALLBACK_ADMIN_EMAILS
  return source.map((email) => email.trim().toLowerCase()).filter(Boolean)
}

/**
 * Checks whether an email belongs to a configured admin.
 */
export function isHardcodedAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase().trim())
}

/**
 * Get all configured admin emails.
 */
export function getAdminEmails(): string[] {
  return adminEmails()
}

/**
 * Get the first (primary) configured admin email.
 */
export function getAdminEmail(): string {
  return adminEmails()[0] ?? ''
}
