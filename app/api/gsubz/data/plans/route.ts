'use server'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { fetchDataPlans } from '@/lib/actions/data'
import { logRequest } from '@/lib/api-logger'

/**
 * Rate-limited API endpoint for fetching data plans
 * Strict limit: 10 requests per minute per IP
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Gsubz Data Plans] → POST | From: ${requestLog.ip}`)

  try {
    // Get IP address for rate limiting
    const ip = getRateLimitIdentifier(request)
    
    // Check rate limit (10 per minute for plan fetches - higher since this is read-only)
    const { allowed, remaining } = await checkRateLimit(ip, {
      interval: 60000,
      maxRequests: 10,
      keyPrefix: 'rl:api:data:plans'
    })

    if (!allowed) {
      const duration = Date.now() - startTime
      console.log(`[Gsubz Data Plans] ✗ Rate limit exceeded | ${duration}ms`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many requests. Maximum 10 per minute. Please wait before trying again.',
          remaining: 0
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Get service ID from request
    const { serviceID } = await request.json()

    console.log(`[Gsubz Data Plans] → Fetching for service: ${serviceID}`)

    // Call server action
    const result = await fetchDataPlans(serviceID)

    if (result.success) {
      const duration = Date.now() - startTime
      console.log(`[Gsubz Data Plans] ✓ SUCCESS | Service: ${serviceID} | Plans: ${result.plans?.length || 0} | ${duration}ms`)
    } else {
      const duration = Date.now() - startTime
      console.log(`[Gsubz Data Plans] ✗ Failed: ${result.error} | ${duration}ms`)
    }

    return NextResponse.json(
      { ...result, remaining },
      { status: result.success ? 200 : 400 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Gsubz Data Plans] ✗ ERROR: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
