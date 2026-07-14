import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDataPlansRealtime } from '@/lib/api/gsubz'

/**
 * GET /api/v1/data/plans?service={service_id}
 *
 * Returns available data plans with clean pricing (no markup details exposed).
 * Prices are always real-time — no cache.
 * Requires X-Connect-Key header.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status ?? 401 }
    )
  }

  const { searchParams } = request.nextUrl
  const service = searchParams.get('service')

  const VALID_SERVICES = [
    'mtn_sme', 'mtn_gifting', 'mtn_datashare', 'mtn_awoof',
    'glo_sme', 'glo_data',
    'airtel_sme', 'airtel_gifting',
    'etisalat_data',
  ]

  if (!service || !VALID_SERVICES.includes(service)) {
    return NextResponse.json(
      {
        success: false,
        error: service
          ? `Invalid service. Valid values: ${VALID_SERVICES.join(', ')}`
          : 'Missing required query param: service',
      },
      { status: 400 }
    )
  }

  const networkMap: Record<string, string> = {
    mtn_sme: 'mtn', mtn_gifting: 'mtn', mtn_datashare: 'mtn', mtn_awoof: 'mtn',
    glo_sme: 'glo', glo_data: 'glo',
    airtel_sme: 'airtel', airtel_gifting: 'airtel',
    etisalat_data: 'etisalat',
  }
  const networkPrefix = networkMap[service]

  try {
    // Fetch live plans from provider + API pricing rules in parallel
    const [planResponse, pricingResult] = await Promise.all([
      getDataPlansRealtime(service),   // always real-time, no cache
      createAdminClient()
        .from('api_pricing_rules')
        .select('plan_name, base_price, markup_type, markup_value')
        .eq('service_id', networkPrefix)
        .eq('is_active', true),
    ])

    const gsubzPlans = planResponse.plans ?? []
    const pricingRules = pricingResult.data ?? []

    // Build clean plan list — match by plan.value (ID), expose only price
    const plans = gsubzPlans
      .map((plan) => {
        // Match pricing rule by plan value/ID (exact match)
        const rule = pricingRules.find(
          (r) => r.plan_name.toLowerCase() === plan.value.toLowerCase()
        )

        if (!rule) return null // plan has no API price configured — hide it

        // Compute final price (base + markup) — never expose breakdown to caller
        const price =
          rule.markup_type === 'fixed'
            ? rule.base_price + rule.markup_value
            : rule.base_price * (1 + rule.markup_value / 100)

        return {
          id: plan.value,           // use this as plan_id in the purchase request
          name: plan.displayName,
          price: Math.round(price * 100) / 100, // 2 d.p., no markup details
        }
      })
      .filter(Boolean)

    return NextResponse.json(
      {
        success: true,
        service,
        plans,
      },
      {
        headers: {
          // Tell clients not to cache — prices are always real-time
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans. Please try again.' },
      { status: 500 }
    )
  }
}
