'use server'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMIT_CONFIG, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { purchaseData } from '@/lib/actions/data'
import { parsePurchaseRequest } from '@/lib/utils/request-body'
/**
 * Rate-limited API endpoint for data purchases
 * Strict limit: 5 requests per minute per IP
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many data purchase requests. Maximum 5 per minute. Please wait before trying again.',
          remaining: 0
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Parse form data (JSON bodies are accepted too — a raw formData() call
    // used to throw on them and surface as an opaque 500).
    const formData = await parsePurchaseRequest(request)
    if (!formData) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Call server action
    const result = await purchaseData(formData)

    return NextResponse.json(
      { ...result, remaining },
      { status: result.success ? 200 : 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
