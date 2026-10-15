/**
 * Admin email fallback list.
 *
 * The PRIMARY source of admin access is `profiles.is_admin = true` in the
 * database — set that column to make someone an admin. This list exists only
 * as a FALLBACK so a specific address keeps working even if its DB flag was
 * never set (bootstrap/recovery).
 *
 * Configure it with the `ADMIN_EMAILS` environment variable — comma-separated,
 * e.g. `ADMIN_EMAILS=admin@mozosubz.xyz,second@example.com`. When the variable
 * is set it REPLACES the historical addresses below; when it is unset, the
 * historical two keep working, so a missing variable can never lock anyone out.
 *
 * IMPORTANT (Vercel): middleware (proxy.ts) runs on the edge runtime, where
 * env vars are bound into the deployment — after changing ADMIN_EMAILS you
 * MUST trigger a new deployment, or the change will look like it "didn't
 * work".
 *
 * Server/edge only: this reads a non-public env var, which is never inlined
 * into the browser bundle — do not call it from a client component.
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
 * True when the email is on the configured fallback admin list.
 * Always combine with the database check: `profile.is_admin || isFallbackAdmin(email)`.
 */
export function isFallbackAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase().trim())
}

/** Backwards-compatible alias. */
export const isHardcodedAdmin = isFallbackAdmin

/**
 * Get all configured fallback admin emails.
 */
export function getAdminEmails(): string[] {
  return adminEmails()
}

/**
 * Get the first (primary) configured fallback admin email.
 */
export function getAdminEmail(): string {
  return adminEmails()[0] ?? ''
}
