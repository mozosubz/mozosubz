/**
 * SMS page maths shared by the dashboard form and the server action.
 *
 * GSUBZ bills per page: 160 characters for the first page and 153 for each
 * subsequent one, or 70/67 when the message needs unicode (emoji, accented
 * scripts). The provider detects the message type itself; this mirror of its
 * rule keeps the upfront price estimate honest. The naira sign is transmitted
 * as "N" (per the API doc) so it stays inside the GSM set.
 */

const GSM7_PATTERN =
  /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæÉéÄäÖöÜüß!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[~\]|€]*$/

export function countSmsPages(message: string): number {
  const text = message.replace(/₦/g, "N")
  if (text.length === 0) return 1
  const unicode = !GSM7_PATTERN.test(text)
  const [first, next] = unicode ? [70, 67] : [160, 153]
  if (text.length <= first) return 1
  return 1 + Math.ceil((text.length - first) / next)
}
