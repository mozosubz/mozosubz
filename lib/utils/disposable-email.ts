/**
 * Disposable / throwaway email domain blocklist.
 *
 * Bounty Round 5: disposable domains were accepted at signup on a payments
 * platform, which makes account farming and abuse cheap. This is a first-line
 * client-side gate; the authoritative enforcement belongs in the auth layer.
 */

const DISPOSABLE_DOMAINS = new Set<string>([
  "0-mail.com",
  "10minutemail.com",
  "10minutemail.net",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "20minutemail.com",
  "33mail.com",
  "anonbox.net",
  "burnermail.io",
  "discard.email",
  "discardmail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "inboxes.com",
  "luxusmail.org",
  "mailcatch.com",
  "maildrop.cc",
  "mailforspam.com",
  "mailinator.com",
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "mail.tm",
  "mailto.plus",
  "maxxspace.com",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mytemp.email",
  "sharklasers.com",
  "sogetthis.com",
  "spam4.me",
  "spamgourmet.com",
  "tempail.com",
  "tempinbox.com",
  "tempmail.com",
  "temp-mail.org",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
])

/**
 * Returns true when the email's domain is a known disposable provider
 * (including subdomains of one, e.g. `foo.mailinator.com`).
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim()
  if (!domain) return false
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true
  }
  return false
}
