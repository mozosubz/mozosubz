'use server'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMIT_CONFIG, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { purchaseData } from '@/lib/actions/data'
import { logRequest } from '@/lib/api-logger'

/**
 * Rate-limited API endpoint for data purchases
 * Strict limit: 5 requests per minute per IP
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Gsubz Data Purchase] → POST | From: ${requestLog.ip}`)

  try {
    // Get IP address for rate limiting
    const ip = getRateLimitIdentifier(request)
    
    // Check rate limit (5 per minute for data purchases)
    const { allowed, remaining } = await checkRateLimit(ip, {
      interval: 60000,
      maxRequests: 5,
      keyPrefix: 'rl:api:data:purchase'
    })

    if (!allowed) {
      const duration = Date.now() - startTime
      console.log(`[Gsubz Data Purchase] ✗ Rate limit exceeded | ${duration}ms`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many data purchase requests. Maximum 5 per minute. Please wait before trying again.',
          remaining: 0
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Parse form data
    const formData = await request.formData()

    console.log(`[Gsubz Data Purchase] → Processing purchase request`)

    // Call server action
    const result = await purchaseData(formData)

    const duration = Date.now() - startTime
    if (result.success) {
      console.log(`[Gsubz Data Purchase] ✓ SUCCESS | ${duration}ms`)
    } else {
      console.log(`[Gsubz Data Purchase] ✗ Failed: ${result.error} | ${duration}ms`)
    }

    return NextResponse.json(
      { ...result, remaining },
      { status: result.success ? 200 : 400 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Gsubz Data Purchase] ✗ ERROR: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
