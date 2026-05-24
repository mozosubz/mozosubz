import { NextRequest, NextResponse } from 'next/server'

// Paths that are commonly scanned for credentials - block these requests
const BLOCKED_PATHS = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.aws/credentials',
  '/backend/.env',
  '/api/.env',
  '/app/.env',
  '/config/credentials.json',
  '/config/service-account.json',
  '/credentials.json',
  '/client_secret.json',
  '/client_secrets.json',
  '/secrets.json',
  '/key.json',
  '/keyfile.json',
  '/firebase.json',
  '/firebase-credentials.json',
  '/firebase-adminsdk.json',
  '/firebase-service-account.json',
  '/serviceAccountKey.json',
  '/gcp-credentials.json',
  '/gcp-service-account.json',
  '/google-credentials.json',
  '/google-service-account.json',
  '/sa-key.json',
  '/app/credentials.json',
  '/service-account.json',
  '/application_default_credentials.json',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase()

  // Block known sensitive file requests
  if (BLOCKED_PATHS.some(path => pathname === path || pathname.endsWith(path))) {
    // Return 404 but don't log it to avoid cluttering logs
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes that are legitimate
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
