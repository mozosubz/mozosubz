export const USERNAME_RX = /^[a-z0-9_-]+$/
export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Well-known names that must never be user-facing handles.
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "support", "help", "helpdesk", "security",
  "root", "staff", "team", "official", "mozosubz", "mozo", "moderator",
  "billing", "payments", "api", "docs", "null", "undefined",
])
