/**
 * Nigerian phone number normalisation.
 *
 * Bounty Round 11: the previous check accepted any 11 digits, so a destination
 * like `00000000000` passed validation and only failed upstream (wasting a VTU
 * call and relying on auto-refund). This enforces a real mobile prefix.
 */

/**
 * Normalises a Nigerian mobile number to local 11-digit form (`0XXXXXXXXXX`).
 * Accepts `+234…`, `234…`, or `0…` input with spaces/dashes. Returns null when
 * the number is not a valid Nigerian mobile line.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const cleaned = String(input).replace(/[\s-]/g, "")
  let local = cleaned

  if (local.startsWith("+234")) {
    local = "0" + local.slice(4)
  } else if (local.startsWith("234")) {
    local = "0" + local.slice(3)
  }

  // Must be 11 digits starting with 0, and the second digit must be 7, 8 or 9
  // (Nigerian mobile ranges: 070/080/081/090/091).
  if (!/^0[789]\d{9}$/.test(local)) return null

  return local
}
