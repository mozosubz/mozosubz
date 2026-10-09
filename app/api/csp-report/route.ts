import { NextResponse } from "next/server"

/**
 * Collector for the report-only CSP in next.config.mjs.
 *
 * Without this route the browser's report POST 404s on every page load, which
 * shows up as a console error. Reports are logged server-side and never
 * surfaced to the client.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    if (body) console.warn("[v0] CSP report:", body.slice(0, 2000))
  } catch {
    // A malformed report must never fail the request.
  }
  return new NextResponse(null, { status: 204 })
}
