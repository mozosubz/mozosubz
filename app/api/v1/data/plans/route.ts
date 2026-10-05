import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDataPlansRealtime } from '@/lib/api/gsubz'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

/**
 * GET /api/v1/data/plans?service={service_id}
 *
 * Returns available data plans with clean pricing (no markup details exposed).
 * Prices are always real-time — no cache.
 * Requires X-Connect-Key header.
 * Rate limited: 50 requests per minute per API key
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Data Plans API] → GET | From: ${requestLog.ip}`)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    const duration = Date.now() - startTime
    console.log(`[Data Plans API] ✗ Auth failed: ${auth.error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status ?? 401 }
    )
  }

  // Check rate limit per API key
  const rateLimitKey = auth.context!.userId
  const { allowed, remaining } = await checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG.V1_DATA_PLANS)

  if (!allowed) {
    const duration = Date.now() - startTime
    console.log(`[Data Plans API] ✗ Rate limit exceeded | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const { searchParams } = request.nextUrl
  const service = searchParams.get('service')

  const VALID_SERVICES = [
    'mtn_sme', 'mtn_gifting', 'mtn_datashare', 'mtn_awoof', 'mtn_awoof2',
    'glo_sme', 'glo_data',
    'airtel_sme', 'airtel_gifting',
    'etisalat_data',
  ]

  if (!service || !VALID_SERVICES.includes(service)) {
    const duration = Date.now() - startTime
    console.log(`[Data Plans API] ✗ Invalid service: ${service} | ${duration}ms`)
    // Bounty fix: don't enumerate the internal service catalog in the error.
    return NextResponse.json(
      {
        success: false,
        error: service
          ? 'Invalid service'
          : 'Missing required query param: service',
      },
      { status: 400 }
    )
  }

  console.log(`[Data Plans API] → Fetching plans for service: ${service}`)

  try {
    // Fetch live plans from provider + API pricing rules in parallel.
    // Query by the full service ID (e.g. 'mtn_sme') so MTN SME, Gifting,
    // AWOOF etc. each have their own separate pricing rules.
    const [planResponse, pricingResult] = await Promise.all([
      getDataPlansRealtime(service),   // always real-time, no cache
      createAdminClient()
        .from('api_pricing_rules')
        .select('plan_name, base_price, markup_type, markup_value, updated_at')
        .eq('service_id', service)     // full service ID, not just network prefix
        .eq('is_active', true)
        // Newest first, so when duplicates exist the freshest rule wins —
        // matching the behaviour of /api/v1/data/purchase.
        .order('updated_at', { ascending: false }),
    ])

    const gsubzPlans = planResponse.plans ?? []
    const pricingRules = pricingResult.data ?? []

    // Build clean plan list:
    // - match pricing rule by plan.displayName (that's what the admin saves as plan_name)
    // - expose plan.value as `id` so callers pass it as plan_id in /data/purchase
    const plans = gsubzPlans
      .map((plan) => {
        // The admin pricing page stores plan.displayName as plan_name — match exactly
        const rule = pricingRules.find(
          (r) => r.plan_name.toLowerCase() === plan.displayName.toLowerCase()
        )

        if (!rule) return null // plan has no API price configured — hide it

        // Compute final price (base + markup) — never expose breakdown to caller
        const price =
          rule.markup_type === 'fixed'
            ? rule.base_price + rule.markup_value
            : rule.base_price * (1 + rule.markup_value / 100)

        return {
          id: plan.value,           // Gsubz plan ID — pass as plan_id in /data/purchase
          name: plan.displayName,   // human-readable name
          price: Math.round(price * 100) / 100,
        }
      })
      .filter(Boolean)

    const duration = Date.now() - startTime
    console.log(`[Data Plans API] ✓ SUCCESS | Service: ${service} | Plans: ${plans.length} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        service,
        plans,
        remaining,
      },
      {
        headers: {
          // Tell clients not to cache — prices are always real-time
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[Data Plans API] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans. Please try again later.' },
      { status: 500 }
    )
  }
}
