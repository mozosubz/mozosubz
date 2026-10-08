/**
 * Health check endpoint for monitoring connectivity
 * Tests basic connectivity and Supabase connection
 */

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const responseTime = Date.now() - startTime

    // SECURITY (bounty INFO): this endpoint is public, so it must not echo
    // infrastructure detail (region, caller IP, build version) back to callers.
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
