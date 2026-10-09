/**
 * The /api/provider/* purchase routes sit in front of server actions that
 * read FormData. They used to call request.formData() directly, which throws
 * on JSON bodies — every JSON request died as an opaque 500 before validation
 * could run. This helper accepts both form-data and JSON objects and never
 * throws: it returns null for an unparseable body so the route can answer 400.
 */
export async function parsePurchaseRequest(request: Request): Promise<FormData | null> {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const fd = new FormData()
      if (body && typeof body === "object") {
        for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
          if (value !== undefined && value !== null) {
            fd.append(key, String(value))
          }
        }
      }
      return fd
    }
    return await request.formData()
  } catch {
    return null
  }
}
